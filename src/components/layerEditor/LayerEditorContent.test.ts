import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LayerEditorContent from '@/components/layerEditor/LayerEditorContent.vue'
import TopBarHeader from '@/components/layerEditor/dialog/TopBarHeader.vue'
import { useCompositorAutoSave } from '@/composables/compositor/useCompositorAutoSave'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

const {
  afterChange,
  autoSaveStop,
  beforeChange,
  loadCompositorSession,
  saveLayerState,
  savePreview,
  session
} = vi.hoisted(() => ({
  afterChange: vi.fn(),
  autoSaveStop: vi.fn(),
  beforeChange: vi.fn(),
  loadCompositorSession: vi.fn().mockResolvedValue(undefined),
  saveLayerState: vi.fn(() => true),
  savePreview: vi.fn().mockResolvedValue(undefined),
  session: {
    canUndo: { value: false },
    dispose: vi.fn(),
    editor: {
      anchorFloating: vi.fn(),
      cancelFloating: vi.fn(),
      floating: vi.fn<() => unknown>(() => null),
      history: {
        canRedo: vi.fn(() => false),
        canUndo: vi.fn(() => false),
        clear: vi.fn()
      }
    },
    imageLayers: { value: [] },
    loadImages: vi.fn().mockResolvedValue(undefined),
    redo: vi.fn(),
    undo: vi.fn()
  }
}))

vi.mock('@/components/ui/dialog/DialogClose.vue', () => ({
  default: (
    _props: unknown,
    { slots }: { slots: { default?: () => unknown } }
  ) => slots.default?.()
}))

vi.mock('@/composables/layerEditor/useLayerEditorSession', () => ({
  isTextEditingTarget: (target: EventTarget | null) =>
    (target as HTMLElement | null)?.tagName === 'INPUT',
  useLayerEditorSession: () => session
}))
vi.mock('@/composables/compositor/compositorSave', () => ({
  saveCompositorLayerState: saveLayerState,
  saveCompositorPreview: savePreview
}))
vi.mock('@/composables/compositor/useCompositorAutoSave', () => ({
  useCompositorAutoSave: vi.fn(() => ({ stop: autoSaveStop }))
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: { changeTracker: { afterChange, beforeChange } }
  })
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: vi.fn() })
}))
vi.mock('@/composables/compositor/compositorSession', () => ({
  loadCompositorSession
}))
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ getNodeImageUrls: () => [] })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', restore: 'Restore' },
      layerEditor: { title: 'Layer Editor' }
    }
  }
})

function renderEditor(mode: 'images' | 'compositor') {
  const node = { id: toNodeId(1) } as unknown as LGraphNode
  render(TopBarHeader, { global: { plugins: [i18n] } })
  return render(LayerEditorContent, {
    props: { node, mode },
    global: {
      plugins: [i18n],
      stubs: {
        LayerEditorCanvas: true,
        LayerEditorToolbar: true,
        LayerPanel: true,
        LayerPropertiesPanel: true
      }
    }
  })
}

function findRestoreButton() {
  return within(screen.getByRole('group')).findByRole('button', {
    name: 'Restore'
  })
}

async function waitForAutoSaveStart() {
  await vi.waitFor(() => expect(useCompositorAutoSave).toHaveBeenCalled())
}

describe('LayerEditorContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.canUndo.value = false
    session.loadImages.mockResolvedValue(undefined)
    loadCompositorSession.mockResolvedValue(undefined)
    session.editor.floating.mockImplementation(() => null)
    session.editor.history.canUndo.mockImplementation(() => false)
    session.editor.history.canRedo.mockImplementation(() => false)
  })

  it('places Restore and Close in the header without Save/Cancel', async () => {
    renderEditor('compositor')

    await findRestoreButton()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('disables Restore while there is nothing to undo', async () => {
    session.canUndo.value = false
    renderEditor('compositor')

    expect(await findRestoreButton()).toBeDisabled()
  })

  it('restores the opening state by unwinding the session history', async () => {
    const user = userEvent.setup()
    session.canUndo.value = true
    renderEditor('compositor')
    session.editor.history.canUndo
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false)

    await user.click(await findRestoreButton())

    expect(session.editor.cancelFloating).toHaveBeenCalled()
    expect(session.undo).toHaveBeenCalledTimes(2)
  })

  it('handles undo/redo shortcuts wherever focus is in the dialog', async () => {
    const user = userEvent.setup()
    renderEditor('compositor')
    await waitForAutoSaveStart()

    await user.keyboard('{Control>}z{/Control}')
    expect(session.undo).toHaveBeenCalledTimes(1)

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(session.redo).toHaveBeenCalledTimes(1)
  })

  it('persists edits and closes the change transaction on unmount', async () => {
    const { unmount } = renderEditor('compositor')
    expect(beforeChange).toHaveBeenCalledTimes(1)
    await waitForAutoSaveStart()
    session.editor.history.canUndo.mockReturnValue(true)

    unmount()

    expect(autoSaveStop).toHaveBeenCalledTimes(1)
    expect(session.editor.anchorFloating).toHaveBeenCalledTimes(1)
    expect(saveLayerState).toHaveBeenCalledTimes(1)
    expect(savePreview).toHaveBeenCalledTimes(1)
    expect(afterChange).toHaveBeenCalledTimes(1)
    expect(session.dispose).toHaveBeenCalledTimes(1)
  })

  it('skips the final save when the session has no edits', async () => {
    const { unmount } = renderEditor('compositor')
    await waitForAutoSaveStart()

    unmount()

    expect(saveLayerState).not.toHaveBeenCalled()
    expect(savePreview).not.toHaveBeenCalled()
    expect(afterChange).toHaveBeenCalledTimes(1)
  })

  it('does not start auto-save when closed while layers are loading', async () => {
    let resolveLoad!: () => void
    loadCompositorSession.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveLoad = resolve))
    )
    const { unmount } = renderEditor('compositor')

    unmount()
    resolveLoad()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(useCompositorAutoSave).not.toHaveBeenCalled()
    expect(afterChange).toHaveBeenCalledTimes(1)
  })

  it('skips persistence entirely in images mode', () => {
    const { unmount } = renderEditor('images')

    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull()

    unmount()

    expect(beforeChange).not.toHaveBeenCalled()
    expect(afterChange).not.toHaveBeenCalled()
    expect(saveLayerState).not.toHaveBeenCalled()
    expect(session.dispose).toHaveBeenCalledTimes(1)
  })
})
