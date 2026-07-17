import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { creditsToCents, usdToCredits } from '@/base/credits/comfyCredits'
import enMessages from '@/locales/en/main.json'
import AutoReloadDialogContent from '@/platform/workspace/components/dialogs/AutoReloadDialogContent.vue'
import { useAutoReload } from '@/platform/workspace/composables/useAutoReload'
import type { AutoReloadConfig } from '@/platform/workspace/composables/useAutoReload'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const dialogStoreMocks = vi.hoisted(() => ({
  closeDialog: vi.fn()
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => dialogStoreMocks
}))

const autoReload = useAutoReload()

function renderDialog(locale = 'en') {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: { en: enMessages }
  })
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      teamWorkspace: { activeWorkspaceId: 'workspace-a' }
    }
  })
  const result = render(AutoReloadDialogContent, {
    global: { plugins: [pinia, i18n] }
  })
  return { ...result, pinia }
}

function setConfig(overrides: Partial<AutoReloadConfig> = {}) {
  Object.assign(autoReload.config, {
    configured: false,
    enabled: false,
    thresholdCredits: 1000,
    reloadCredits: 5000,
    monthlyBudgetCents: null,
    spentThisCycleCents: 0,
    ...overrides
  } satisfies AutoReloadConfig)
}

describe('AutoReloadDialogContent', () => {
  beforeEach(() => {
    dialogStoreMocks.closeDialog.mockReset()
    autoReload.scopeToWorkspace('workspace-a')
    setConfig()
  })

  it('blocks an update below the minimum reload amount', async () => {
    const user = userEvent.setup()
    renderDialog()

    const amount = screen.getByLabelText('Add this amount of credits:')
    await user.clear(amount)
    await user.type(amount, '1000')

    expect(screen.getByText('Minimum amount is 1,055')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
  })

  it('saves the minimum valid credit configuration', async () => {
    const user = userEvent.setup()
    renderDialog()

    const amount = screen.getByLabelText('Add this amount of credits:')
    await user.clear(amount)
    await user.type(amount, String(usdToCredits(5)))
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(autoReload.config).toMatchObject({
      configured: true,
      enabled: true,
      thresholdCredits: 1000,
      reloadCredits: usdToCredits(5),
      monthlyBudgetCents: null
    })
    expect(dialogStoreMocks.closeDialog).toHaveBeenCalledWith({
      key: 'auto-reload'
    })
  })

  it('requires a positive budget when the monthly limit is enabled', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('switch', { name: 'Monthly budget' }))
    const budget = screen.getByRole('textbox', { name: 'Monthly budget' })

    expect(budget).toBeEnabled()
    expect(budget).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Enter a monthly budget')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()

    await user.type(budget, '11000')

    expect(screen.getByText('Allows 2 reloads /mo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(autoReload.config.monthlyBudgetCents).toBe(creditsToCents(11_000))
  })

  it('removes a budget without disabling auto-reload', async () => {
    const user = userEvent.setup()
    setConfig({
      configured: true,
      enabled: true,
      monthlyBudgetCents: 50_000
    })
    renderDialog()

    await user.click(screen.getByRole('switch', { name: 'Monthly budget' }))
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(autoReload.config).toMatchObject({
      configured: true,
      enabled: true,
      monthlyBudgetCents: null
    })
  })

  it('normalizes USD input to whole credits', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByText('USD'))
    const amount = screen.getByLabelText('Add this amount of credits:')
    await user.clear(amount)
    await user.type(amount, '10')
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(autoReload.config.reloadCredits).toBe(usdToCredits(10))
  })

  it('preserves canonical amounts across display-unit round trips', async () => {
    const user = userEvent.setup()
    setConfig({ monthlyBudgetCents: 50_000 })
    renderDialog()

    await user.click(screen.getByText('USD'))
    await user.click(screen.getByText('Credits'))
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(autoReload.config.reloadCredits).toBe(5000)
    expect(autoReload.config.monthlyBudgetCents).toBe(50_000)
  })

  it('preserves untouched canonical amounts in grouped-decimal locales', async () => {
    const user = userEvent.setup()
    setConfig({ monthlyBudgetCents: 50_000 })
    renderDialog('pt-BR')

    expect(screen.getByLabelText('Add this amount of credits:')).toHaveValue(
      '5.000'
    )
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(autoReload.config).toMatchObject({
      thresholdCredits: 1000,
      reloadCredits: 5000,
      monthlyBudgetCents: 50_000
    })
  })

  it('localizes the USD currency indicator', async () => {
    const user = userEvent.setup()
    renderDialog('pt-BR')

    await user.click(screen.getByText('USD'))

    expect(screen.getAllByText('US$')).toHaveLength(2)
  })

  it('accepts localized non-Latin digits', async () => {
    const user = userEvent.setup()
    renderDialog('fa')

    const amount = screen.getByLabelText('Add this amount of credits:')
    await fireEvent.update(amount, '۱٬۰۵۵')
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(autoReload.config.reloadCredits).toBe(1055)
  })

  it('cancels without changing the configuration', async () => {
    const user = userEvent.setup()
    setConfig({ configured: true, enabled: false, thresholdCredits: 2500 })
    const before = { ...autoReload.config }
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect({ ...autoReload.config }).toEqual(before)
    expect(dialogStoreMocks.closeDialog).toHaveBeenCalledWith({
      key: 'auto-reload'
    })
  })

  it('keeps Update disabled when the threshold is empty', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.clear(screen.getByLabelText('When credits drop below:'))

    expect(screen.getByLabelText('When credits drop below:')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByText('Enter a credit threshold')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
  })

  it('provides the accessible name expected by the dialog renderer', () => {
    renderDialog()

    expect(
      screen.getByRole('heading', { name: 'Auto-reload credits' })
    ).toHaveAttribute('id', 'auto-reload')
  })

  it('clears temporary settings and closes when the workspace changes', async () => {
    setConfig({ configured: true, enabled: true })
    const { pinia } = renderDialog()

    useTeamWorkspaceStore(pinia).activeWorkspaceId = 'workspace-b'
    await nextTick()

    expect(autoReload.config.configured).toBe(false)
    expect(dialogStoreMocks.closeDialog).toHaveBeenCalledWith({
      key: 'auto-reload'
    })
  })
})
