import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import AutoReloadSection from '@/platform/workspace/components/dialogs/settings/AutoReloadSection.vue'
import { useAutoReload } from '@/platform/workspace/composables/useAutoReload'
import type { AutoReloadConfig } from '@/platform/workspace/composables/useAutoReload'

const dialogMocks = vi.hoisted(() => ({
  showAutoReloadDialog: vi.fn()
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => dialogMocks
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const autoReload = useAutoReload()

function renderSection(frozen = false, workspaceId = 'workspace-a') {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      teamWorkspace: { activeWorkspaceId: workspaceId }
    }
  })
  const result = render(AutoReloadSection, {
    props: { frozen },
    global: { plugins: [pinia, i18n] }
  })
  return { ...result, pinia }
}

function setConfig(overrides: Partial<AutoReloadConfig> = {}) {
  Object.assign(autoReload.config, {
    configured: true,
    enabled: true,
    thresholdCredits: 1000,
    reloadCredits: 5000,
    monthlyBudgetCents: 50_000,
    spentThisCycleCents: 4_800,
    ...overrides
  } satisfies AutoReloadConfig)
}

describe('AutoReloadSection', () => {
  beforeEach(() => {
    dialogMocks.showAutoReloadDialog.mockReset()
    autoReload.scopeToWorkspace('workspace-a')
    setConfig({ configured: false, enabled: false, monthlyBudgetCents: null })
  })

  it('opens setup from the not-configured state', async () => {
    const user = userEvent.setup()
    renderSection()

    expect(
      screen.getByText(
        "Keep your workflows running with auto-reloaded credits. Set a monthly budget so charges don't surprise you."
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Set up auto-reload' }))

    expect(dialogMocks.showAutoReloadDialog).toHaveBeenCalledOnce()
  })

  it('renders an enabled configuration without a budget', async () => {
    const user = userEvent.setup()
    setConfig({ monthlyBudgetCents: null })
    renderSection()

    expect(screen.getByText('5,000')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.queryByText('Monthly budget')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(dialogMocks.showAutoReloadDialog).toHaveBeenCalledOnce()
  })

  it('renders healthy monthly budget progress', () => {
    setConfig()
    renderSection()

    expect(screen.getByText('10% spent')).toBeInTheDocument()
    expect(screen.getByText('$48 of $500')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '10'
    )
  })

  it('uses the near-limit treatment when one reload remains', () => {
    setConfig({ spentThisCycleCents: 47_600 })
    renderSection()

    expect(screen.getByText('95% spent')).toHaveClass('text-credit')
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
  })

  it('renders the exhausted budget as paused', () => {
    setConfig({ spentThisCycleCents: 50_000 })
    renderSection()

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('100% spent')).toHaveClass('text-danger')
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    )
  })

  it('retains the configured values when switched off', async () => {
    const user = userEvent.setup()
    setConfig({ enabled: false })
    renderSection()

    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByText('5,000')).toBeInTheDocument()

    await user.click(
      screen.getByRole('switch', { name: 'Enable credit auto-reload' })
    )
    expect(autoReload.isEnabled.value).toBe(true)
  })

  it('freezes all controls for a plan that cannot spend', async () => {
    const user = userEvent.setup()
    setConfig({ spentThisCycleCents: 50_000 })
    renderSection(true)

    const section = screen.getByTestId('auto-reload-section')
    expect(section).toHaveAttribute('inert')
    expect(section).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByText('Off')).toHaveClass('bg-secondary-background')
    expect(
      screen.getByRole('switch', { name: 'Enable credit auto-reload' })
    ).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(dialogMocks.showAutoReloadDialog).not.toHaveBeenCalled()
  })

  it('clears temporary settings when the workspace changes while settings are closed', async () => {
    setConfig()
    const currentWorkspace = renderSection()
    currentWorkspace.unmount()

    renderSection(false, 'workspace-b')
    await nextTick()

    expect(autoReload.config.configured).toBe(false)
    expect(screen.getByText('Set up auto-reload')).toBeInTheDocument()
  })
})
