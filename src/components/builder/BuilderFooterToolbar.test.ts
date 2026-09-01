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
  changeTracker?: { captureCanvasState: () => void }
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

  function renderComponent() {
    const user = userEvent.setup()

    render(BuilderFooterToolbar, {
      global: {
        plugins: [i18n],
        stubs: {
          Button: false,
          BuilderOpensAsPopover: true,
          ConnectOutputPopover: { template: '<div><slot /></div>' }
        }
      }
    })

    return { user }
  }

  it('disables back on the first step', () => {
    mockState.mode = 'builder:inputs'
    renderComponent()
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled()
  })

  it('enables back on the arrange step', () => {
    mockState.mode = 'builder:arrange'
    renderComponent()
    expect(screen.getByRole('button', { name: /back/i })).toBeEnabled()
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

  it('calls exitBuilder on exit button click', async () => {
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /exit app builder/i }))
    expect(mockExitBuilder).toHaveBeenCalledOnce()
  })

  it('calls setMode app on view app click', async () => {
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /view app/i }))
    expect(mockSetMode).toHaveBeenCalledWith('app')
  })

  it('shows "Save as" when workflow is temporary', () => {
    mockActiveWorkflow.value = { isTemporary: true }
    renderComponent()
    expect(screen.getByRole('button', { name: 'Save as' })).toBeDefined()
  })

  it('shows "Save" when workflow is saved', () => {
    mockActiveWorkflow.value = { isTemporary: false }
    renderComponent()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined()
  })

  it('calls saveAs when workflow is temporary', async () => {
    mockActiveWorkflow.value = { isTemporary: true }
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: 'Save as' }))
    expect(mockSaveAs).toHaveBeenCalledOnce()
  })

  it('calls save when workflow is saved and modified', async () => {
    mockActiveWorkflow.value = { isTemporary: false, isModified: true }
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mockSave).toHaveBeenCalledOnce()
  })

  it('disables save button when workflow has no unsaved changes', () => {
    mockActiveWorkflow.value = { isTemporary: false, isModified: false }
    renderComponent()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('does not call save when no outputs', async () => {
    mockHasOutputs.value = false
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: 'Save as' }))
    expect(mockSave).not.toHaveBeenCalled()
    expect(mockSaveAs).not.toHaveBeenCalled()
  })
})
