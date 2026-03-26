import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AppMode } from '@/composables/useAppMode'

import BuilderFooterToolbar from '@/components/builder/BuilderFooterToolbar.vue'

const mockSetMode = vi.hoisted(() => vi.fn())
const mockExitBuilder = vi.hoisted(() => vi.fn())
const mockSave = vi.hoisted(() => vi.fn())
const mockSaveAs = vi.hoisted(() => vi.fn())

const mockState = {
  mode: 'builder:inputs' as AppMode
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

const mockActiveWorkflow = ref<{
  isTemporary: boolean
  initialMode?: string
  isModified?: boolean
  changeTracker?: { checkState: () => void }
} | null>({
  isTemporary: true,
  initialMode: 'app'
})

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mockActiveWorkflow.value
    }
  })
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { extra: {} } }
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => null
}))

vi.mock('./useBuilderSave', () => ({
  useBuilderSave: () => ({
    save: mockSave,
    saveAs: mockSaveAs,
    isSaving: { value: false }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      builderMenu: { exitAppBuilder: 'Exit app builder' },
      builderToolbar: {
        viewApp: 'View app',
        saveAs: 'Save as',
        app: 'App',
        nodeGraph: 'Node graph'
      },
      builderFooter: {
        opensAsApp: 'Open as an {mode}',
        opensAsGraph: 'Open as a {mode}'
      },
      g: { back: 'Back', next: 'Next', save: 'Save' }
    }
  }
})

describe('BuilderFooterToolbar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockState.mode = 'builder:inputs'
    mockHasOutputs.value = true
    mockActiveWorkflow.value = { isTemporary: true, initialMode: 'app' }
  })

  function mountComponent() {
    return mount(BuilderFooterToolbar, {
      global: {
        plugins: [i18n],
        stubs: {
          Button: false,
          BuilderOpensAsPopover: true,
          ConnectOutputPopover: { template: '<div><slot /></div>' }
        }
      }
    })
  }

  function findButtonByText(
    wrapper: ReturnType<typeof mountComponent>,
    text: string
  ) {
    const nav = wrapper.find('nav')
    const btn = nav.findAll('button').find((b) => b.text().trim() === text)
    if (!btn) throw new Error(`Button "${text}" not found`)
    return btn
  }

  function getNavButtons(wrapper: ReturnType<typeof mountComponent>) {
    return {
      exit: findButtonByText(wrapper, 'Exit app builder'),
      viewApp: findButtonByText(wrapper, 'View app'),
      back: findButtonByText(wrapper, 'Back'),
      next: findButtonByText(wrapper, 'Next')
    }
  }

  it('disables back on the first step', () => {
    mockState.mode = 'builder:inputs'
    const { back } = getNavButtons(mountComponent())
    expect(back.attributes('disabled')).toBeDefined()
  })

  it('enables back on the arrange step', () => {
    mockState.mode = 'builder:arrange'
    const { back } = getNavButtons(mountComponent())
    expect(back.attributes('disabled')).toBeUndefined()
  })

  it('disables next on arrange step (last step)', () => {
    mockState.mode = 'builder:arrange'
    const { next } = getNavButtons(mountComponent())
    expect(next.attributes('disabled')).toBeDefined()
  })

  it('disables next on arrange step when no outputs', () => {
    mockState.mode = 'builder:arrange'
    mockHasOutputs.value = false
    const { next } = getNavButtons(mountComponent())
    expect(next.attributes('disabled')).toBeDefined()
  })

  it('enables next on inputs step', () => {
    mockState.mode = 'builder:inputs'
    const { next } = getNavButtons(mountComponent())
    expect(next.attributes('disabled')).toBeUndefined()
  })

  it('calls setMode on back click', async () => {
    mockState.mode = 'builder:arrange'
    const { back } = getNavButtons(mountComponent())
    await back.trigger('click')
    expect(mockSetMode).toHaveBeenCalledWith('builder:outputs')
  })

  it('calls setMode on next click from inputs step', async () => {
    mockState.mode = 'builder:inputs'
    const { next } = getNavButtons(mountComponent())
    await next.trigger('click')
    expect(mockSetMode).toHaveBeenCalledWith('builder:outputs')
  })

  it('calls exitBuilder on exit button click', async () => {
    const { exit } = getNavButtons(mountComponent())
    await exit.trigger('click')
    expect(mockExitBuilder).toHaveBeenCalledOnce()
  })

  it('calls setMode app on view app click', async () => {
    const { viewApp } = getNavButtons(mountComponent())
    await viewApp.trigger('click')
    expect(mockSetMode).toHaveBeenCalledWith('app')
  })

  it('shows "Save as" when workflow is temporary', () => {
    mockActiveWorkflow.value = { isTemporary: true }
    const wrapper = mountComponent()
    expect(findButtonByText(wrapper, 'Save as')).toBeDefined()
  })

  it('shows "Save" when workflow is saved', () => {
    mockActiveWorkflow.value = { isTemporary: false }
    const wrapper = mountComponent()
    expect(findButtonByText(wrapper, 'Save')).toBeDefined()
  })

  it('calls saveAs when workflow is temporary', async () => {
    mockActiveWorkflow.value = { isTemporary: true }
    await findButtonByText(mountComponent(), 'Save as').trigger('click')
    expect(mockSaveAs).toHaveBeenCalledOnce()
  })

  it('calls save when workflow is saved and modified', async () => {
    mockActiveWorkflow.value = { isTemporary: false, isModified: true }
    await findButtonByText(mountComponent(), 'Save').trigger('click')
    expect(mockSave).toHaveBeenCalledOnce()
  })

  it('disables save button when workflow has no unsaved changes', () => {
    mockActiveWorkflow.value = { isTemporary: false, isModified: false }
    const save = findButtonByText(mountComponent(), 'Save')
    expect(save.attributes('disabled')).toBeDefined()
  })

  it('does not call save when no outputs', async () => {
    mockHasOutputs.value = false
    const wrapper = mountComponent()
    await findButtonByText(wrapper, 'Save as').trigger('click')
    expect(mockSave).not.toHaveBeenCalled()
    expect(mockSaveAs).not.toHaveBeenCalled()
  })
})
