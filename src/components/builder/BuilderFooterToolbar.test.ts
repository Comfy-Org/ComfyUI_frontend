import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import BuilderFooterToolbar from '@/components/builder/BuilderFooterToolbar.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { toNodeId } from '@/types/nodeId'
import type { AppMode } from '@/utils/appMode'

const mockSave = vi.hoisted(() => vi.fn())
const mockSaveAs = vi.hoisted(() => vi.fn())

vi.mock(import('@/composables/useAppMode'))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraph: { extra: {} } }
}))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(import('./useBuilderSave'), () => ({
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
  let mode: Ref<AppMode>

  beforeEach(() => {
    mode = ref<AppMode>('builder:inputs')
    useAppMode().mode = computed(() => mode.value)
    useAppMode().isBuilderMode = computed(() => true)
    vi.mocked(useAppModeStore().exitBuilder).mockImplementation(() => {})
    useAppModeStore().selectedOutputs = [toNodeId('1')]
    useWorkflowStore().activeWorkflow = fromPartial({
      isTemporary: true,
      initialMode: 'app'
    })
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
    renderComponent()
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled()
  })

  it('enables back on the arrange step', () => {
    mode.value = 'builder:arrange'
    renderComponent()
    expect(screen.getByRole('button', { name: /back/i })).toBeEnabled()
  })

  it('disables next on arrange step when no outputs', () => {
    mode.value = 'builder:arrange'
    useAppModeStore().selectedOutputs = []
    renderComponent()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('enables next on inputs step', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('calls setMode on back click', async () => {
    mode.value = 'builder:arrange'
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(useAppMode().setMode).toHaveBeenCalledWith('builder:outputs')
  })

  it('calls setMode on next click from inputs step', async () => {
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(useAppMode().setMode).toHaveBeenCalledWith('builder:outputs')
  })

  it('calls exitBuilder on exit button click', async () => {
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /exit app builder/i }))
    expect(useAppModeStore().exitBuilder).toHaveBeenCalledOnce()
  })

  it('calls setMode app on view app click', async () => {
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: /view app/i }))
    expect(useAppMode().setMode).toHaveBeenCalledWith('app')
  })

  it('shows "Save as" when workflow is temporary', () => {
    useWorkflowStore().activeWorkflow = fromPartial({ isTemporary: true })
    renderComponent()
    expect(screen.getByRole('button', { name: 'Save as' })).toBeDefined()
  })

  it('shows "Save" when workflow is saved', () => {
    useWorkflowStore().activeWorkflow = fromPartial({ isTemporary: false })
    renderComponent()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined()
  })

  it('calls saveAs when workflow is temporary', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({ isTemporary: true })
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: 'Save as' }))
    expect(mockSaveAs).toHaveBeenCalledOnce()
  })

  it('calls save when workflow is saved and modified', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      isTemporary: false,
      isModified: true
    })
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mockSave).toHaveBeenCalledOnce()
  })

  it('disables save button when workflow has no unsaved changes', () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      isTemporary: false,
      isModified: false
    })
    renderComponent()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('does not call save when no outputs', async () => {
    useAppModeStore().selectedOutputs = []
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: 'Save as' }))
    expect(mockSave).not.toHaveBeenCalled()
    expect(mockSaveAs).not.toHaveBeenCalled()
  })
})
