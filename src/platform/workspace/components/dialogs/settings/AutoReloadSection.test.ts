import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getActivePinia } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import AutoReloadSection from '@/platform/workspace/components/dialogs/settings/AutoReloadSection.vue'
import { useAutoReload } from '@/platform/workspace/composables/useAutoReload'
import type { AutoReloadConfig } from '@/platform/workspace/composables/useAutoReload'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

const mockCanAccess = ref(true)
const mockAccessFrozen = ref(false)

vi.mock(import('@/platform/workspace/composables/useAutoReloadAccess'), () => ({
  useAutoReloadAccess: () => {
    const canConfigureNow = () => mockCanAccess.value && !mockAccessFrozen.value
    return {
      canAccess: computed(() => mockCanAccess.value),
      isFrozen: computed(() => mockAccessFrozen.value),
      canConfigure: computed(canConfigureNow),
      canConfigureNow
    }
  }
}))

vi.mock(import('@/services/dialogService'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const autoReload = useAutoReload()

function renderSection(frozen = false, workspaceId = 'workspace-a') {
  Object.assign(useTeamWorkspaceStore(), {
    activeWorkspaceId: workspaceId
  })
  return render(AutoReloadSection, {
    props: { frozen },
    global: { plugins: [getActivePinia()!, i18n] }
  })
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
    mockCanAccess.value = true
    mockAccessFrozen.value = false
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

    expect(
      vi.mocked(useDialogService().showAutoReloadDialog)
    ).toHaveBeenCalledOnce()
    const [options] = vi.mocked(useDialogService().showAutoReloadDialog).mock
      .calls[0]
    expect(options.workspaceId).toBe('workspace-a')
    expect(options.canOpen()).toBe(true)

    mockCanAccess.value = false
    expect(options.canOpen()).toBe(false)
  })

  it('invalidates a pending lazy-open guard when the section unmounts', async () => {
    const user = userEvent.setup()
    const section = renderSection()

    await user.click(screen.getByRole('button', { name: 'Set up auto-reload' }))
    const [options] = vi.mocked(useDialogService().showAutoReloadDialog).mock
      .calls[0]
    expect(options.canOpen()).toBe(true)

    section.unmount()

    expect(options.canOpen()).toBe(false)
  })

  it('renders an enabled configuration without a budget', async () => {
    const user = userEvent.setup()
    setConfig({ monthlyBudgetCents: null })
    renderSection()

    expect(screen.getByText('5,000')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.queryByText('Monthly budget')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(
      vi.mocked(useDialogService().showAutoReloadDialog)
    ).toHaveBeenCalledOnce()
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

    expect(screen.getByText('95% spent')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Monthly budget is near its limit'
    )
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
  })

  it('renders the exhausted budget as paused', () => {
    setConfig({ spentThisCycleCents: 50_000 })
    renderSection()

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('100% spent')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    )
  })

  it('renders normalized values for malformed financial state', () => {
    setConfig({
      monthlyBudgetCents: Number.NaN,
      spentThisCycleCents: Number.POSITIVE_INFINITY
    })
    renderSection()

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('100% spent')).toBeInTheDocument()
    expect(screen.getByText('$0 of $0')).toBeInTheDocument()
    expect(screen.queryByText(/NaN|∞|Infinity/)).not.toBeInTheDocument()
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

  it('rejects an enabled-state change after access is revoked', async () => {
    const user = userEvent.setup()
    setConfig({ enabled: true })
    renderSection()

    mockCanAccess.value = false
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
    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'Enable credit auto-reload' })
    ).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(
      vi.mocked(useDialogService().showAutoReloadDialog)
    ).not.toHaveBeenCalled()
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
