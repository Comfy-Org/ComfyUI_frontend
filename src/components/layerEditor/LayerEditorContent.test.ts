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
  saveLayerState,
  savePreview,
  session
} = vi.hoisted(() => ({
  afterChange: vi.fn(),
  autoSaveStop: vi.fn(),
  beforeChange: vi.fn(),
  saveLayerState: vi.fn(() => true),
  savePreview: vi.fn().mockResolvedValue(undefined),
  session: {
    dispose: vi.fn(),
    editor: {
      anchorFloating: vi.fn(),
      cancelFloating: vi.fn(),
      floating: vi.fn<() => unknown>(() => null),
      history: { canUndo: vi.fn(() => false), clear: vi.fn() }
    },
    imageLayers: { value: [] },
    loadImages: vi.fn().mockResolvedValue(undefined),
    undo: vi.fn()
  }
}))

vi.mock('@/composables/layerEditor/useLayerEditorSession', () => ({
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
vi.mock('@/composables/compositor/useCompositorLayers', () => ({
  getCompositorBBoxes: () => [],
  getCompositorInputsFingerprint: () => [],
  getCompositorLayers: () => []
}))
vi.mock('@/composables/compositor/compositorLayerState', () => ({
  applyLayerState: vi.fn(),
  parseLayerState: () => null,
  resolveInitialLayerState: () => null
}))
vi.mock('@/composables/compositor/compositorWidgets', () => ({
  getCompositorWidgetValue: () => ''
}))
vi.mock('@/scripts/api', () => ({
  api: { apiURL: (url: string) => url }
}))
vi.mock('@/scripts/app', () => ({
  app: { getRandParam: () => '' }
}))
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ getNodeImageUrls: () => [] })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { restore: 'Restore' },
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

describe('LayerEditorContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('places a single Restore action in the header', async () => {
    renderEditor('compositor')

    await findRestoreButton()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('restores the opening state by unwinding the session history', async () => {
    const user = userEvent.setup()
    renderEditor('compositor')
    session.editor.history.canUndo
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false)

    await user.click(await findRestoreButton())

    expect(session.undo).toHaveBeenCalledTimes(2)
    expect(session.editor.cancelFloating).not.toHaveBeenCalled()
  })

  it('auto-saves the session and persists on close', async () => {
    const { unmount } = renderEditor('compositor')
    expect(beforeChange).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(useCompositorAutoSave).toHaveBeenCalled())

    unmount()

    expect(autoSaveStop).toHaveBeenCalledTimes(1)
    expect(saveLayerState).toHaveBeenCalledTimes(1)
    expect(savePreview).toHaveBeenCalledTimes(1)
    expect(afterChange).toHaveBeenCalledTimes(1)
    expect(session.dispose).toHaveBeenCalledTimes(1)
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
