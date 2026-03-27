import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AppMode } from '@/composables/useAppMode'

import BuilderFooterToolbar from '@/components/builder/BuilderFooterToolbar.vue'

const mockSetMode = vi.hoisted(() => vi.fn())
const mockExitBuilder = vi.hoisted(() => vi.fn())
const mockShowDialog = vi.hoisted(() => vi.fn())

const mockState = {
  mode: 'builder:select' as AppMode,
  settingView: false
}

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    mode: computed(() => mockState.mode),
    isBuilderMode: ref(true),
    setMode: mockSetMode
  })
}))

const mockHasOutputs = ref(true)

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    exitBuilder: mockExitBuilder,
    hasOutputs: mockHasOutputs,
    $id: 'appMode'
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    dialogStack: []
  })
}))

vi.mock('@/components/builder/useAppSetDefaultView', () => ({
  useAppSetDefaultView: () => ({
    settingView: computed(() => mockState.settingView),
    showDialog: mockShowDialog
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      builderMenu: { exitAppBuilder: 'Exit app builder' },
      g: { back: 'Back', next: 'Next' }
    }
  }
})

describe('BuilderFooterToolbar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockState.mode = 'builder:inputs'
    mockHasOutputs.value = true
    mockState.settingView = false
  })

  function renderComponent() {
    const user = userEvent.setup()

    render(BuilderFooterToolbar, {
      global: {
        plugins: [i18n],
        stubs: { Button: false }
      }
    })

    return { user }
  }

  it('disables back on the first step', () => {
    mockState.mode = 'builder:inputs'
    renderComponent()
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled()
  })

  it('enables back on the second step', () => {
    mockState.mode = 'builder:arrange'
    renderComponent()
    expect(screen.getByRole('button', { name: /back/i })).toBeEnabled()
  })

  it('disables next on the setDefaultView step', () => {
    mockState.settingView = true
    renderComponent()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('disables next on arrange step when no outputs', () => {
    mockState.mode = 'builder:arrange'
    mockHasOutputs.value = false
    renderComponent()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('enables next on inputs step', () => {
    mockState.mode = 'builder:inputs'
    renderComponent()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('calls setMode on back click', async () => {
    mockState.mode = 'builder:arrange'
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(mockSetMode).toHaveBeenCalledWith('builder:outputs')
  })

  it('calls setMode on next click from inputs step', async () => {
    mockState.mode = 'builder:inputs'
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(mockSetMode).toHaveBeenCalledWith('builder:outputs')
  })

  it('opens default view dialog on next click from arrange step', async () => {
    mockState.mode = 'builder:arrange'
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(mockSetMode).toHaveBeenCalledWith('builder:arrange')
    expect(mockShowDialog).toHaveBeenCalledOnce()
  })

  it('calls exitBuilder on exit button click', async () => {
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /exit app builder/i }))
    expect(mockExitBuilder).toHaveBeenCalledOnce()
  })
})
