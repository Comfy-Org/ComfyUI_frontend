import { mount } from '@vue/test-utils'
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

  function mountComponent() {
    return mount(BuilderFooterToolbar, {
      global: {
        plugins: [i18n],
        stubs: { Button: false }
      }
    })
  }

  function getButtons(wrapper: ReturnType<typeof mountComponent>) {
    const buttons = wrapper.findAll('button')
    return {
      exit: buttons[0],
      back: buttons[1],
      next: buttons[2]
    }
  }

  it('disables back on the first step', () => {
    mockState.mode = 'builder:inputs'
    const { back } = getButtons(mountComponent())
    expect(back.attributes('disabled')).toBeDefined()
  })

  it('enables back on the second step', () => {
    mockState.mode = 'builder:arrange'
    const { back } = getButtons(mountComponent())
    expect(back.attributes('disabled')).toBeUndefined()
  })

  it('disables next on the setDefaultView step', () => {
    mockState.settingView = true
    const { next } = getButtons(mountComponent())
    expect(next.attributes('disabled')).toBeDefined()
  })

  it('disables next on arrange step when no outputs', () => {
    mockState.mode = 'builder:arrange'
    mockHasOutputs.value = false
    const { next } = getButtons(mountComponent())
    expect(next.attributes('disabled')).toBeDefined()
  })

  it('enables next on inputs step', () => {
    mockState.mode = 'builder:inputs'
    const { next } = getButtons(mountComponent())
    expect(next.attributes('disabled')).toBeUndefined()
  })

  it('calls setMode on back click', async () => {
    mockState.mode = 'builder:arrange'
    const { back } = getButtons(mountComponent())
    await back.trigger('click')
    expect(mockSetMode).toHaveBeenCalledWith('builder:outputs')
  })

  it('calls setMode on next click from inputs step', async () => {
    mockState.mode = 'builder:inputs'
    const { next } = getButtons(mountComponent())
    await next.trigger('click')
    expect(mockSetMode).toHaveBeenCalledWith('builder:outputs')
  })

  it('opens default view dialog on next click from arrange step', async () => {
    mockState.mode = 'builder:arrange'
    const { next } = getButtons(mountComponent())
    await next.trigger('click')
    expect(mockSetMode).toHaveBeenCalledWith('builder:arrange')
    expect(mockShowDialog).toHaveBeenCalledOnce()
  })

  it('calls exitBuilder on exit button click', async () => {
    const { exit } = getButtons(mountComponent())
    await exit.trigger('click')
    expect(mockExitBuilder).toHaveBeenCalledOnce()
  })
})
