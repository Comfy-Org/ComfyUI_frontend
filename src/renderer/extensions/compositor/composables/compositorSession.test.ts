import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import { loadCompositorSession } from './compositorSession'

const {
  applyLayerState,
  getCompositorCanvas,
  getCompositorLayers,
  resolveInitialLayerState
} = vi.hoisted(() => ({
  applyLayerState: vi.fn(),
  getCompositorCanvas: vi.fn<() => unknown>(() => undefined),
  getCompositorLayers: vi.fn<() => unknown>(() => []),
  resolveInitialLayerState: vi.fn<() => unknown>(() => null)
}))

vi.mock(
  '@/renderer/extensions/compositor/composables/compositorLayerState',
  () => ({
    applyLayerState,
    parseLayerState: () => null,
    resolveInitialLayerState
  })
)
vi.mock(
  '@/renderer/extensions/compositor/composables/useCompositorLayers',
  () => ({
    getCompositorBBoxes: () => undefined,
    getCompositorCanvas,
    getCompositorInputsFingerprint: () => undefined,
    getCompositorLayers
  })
)
vi.mock(
  '@/renderer/extensions/compositor/composables/compositorWidgets',
  () => ({
    getCompositorWidgetValue: () => ({})
  })
)
vi.mock('@/scripts/api', () => ({
  api: { apiURL: (path: string) => `http://host/api${path}` }
}))
vi.mock('@/scripts/app', () => ({
  app: { getRandParam: () => '&rand=0.5' }
}))

function makeSession() {
  return {
    loadImages: vi.fn().mockResolvedValue(0),
    imageLayers: { value: [{ id: 'a', visible: true }] },
    editor: { history: { clear: vi.fn() } },
    fitView: vi.fn(),
    setCanvasSize: vi.fn()
  }
}

const node = { id: toNodeId(3) } as unknown as LGraphNode
const fallbackName = (i: number) => `Layer ${i + 1}`

describe('loadCompositorSession', () => {
  beforeEach(() => {
    getCompositorLayers.mockReturnValue([])
    getCompositorCanvas.mockReturnValue(undefined)
    resolveInitialLayerState.mockReturnValue(null)
  })

  it('loads cached layer refs as view URLs with filename-derived names', async () => {
    getCompositorLayers.mockReturnValue([
      { filename: 'first.png', subfolder: 'sub', type: 'temp' },
      { filename: '', subfolder: '', type: 'temp' }
    ])
    const session = makeSession()

    await loadCompositorSession(
      session as unknown as LayerEditorSession,
      node,
      fallbackName
    )

    expect(session.loadImages).toHaveBeenCalledWith(
      [
        'http://host/api/view?filename=first.png&subfolder=sub&type=temp&rand=0.5',
        'http://host/api/view?filename=&type=temp&rand=0.5'
      ],
      ['first', 'Layer 2']
    )
  })

  it('applies the resolved initial state and clears history', async () => {
    const state = { layers: [] }
    resolveInitialLayerState.mockReturnValue(state)
    const session = makeSession()

    await loadCompositorSession(
      session as unknown as LayerEditorSession,
      node,
      fallbackName
    )

    expect(applyLayerState).toHaveBeenCalledWith(
      state,
      session.imageLayers.value,
      session
    )
    expect(session.editor.history.clear).toHaveBeenCalled()
    expect(session.fitView).toHaveBeenCalled()
  })

  it('leaves the freshly loaded session untouched without an initial state', async () => {
    const session = makeSession()

    await loadCompositorSession(
      session as unknown as LayerEditorSession,
      node,
      fallbackName
    )

    expect(applyLayerState).not.toHaveBeenCalled()
    expect(session.editor.history.clear).not.toHaveBeenCalled()
    expect(session.setCanvasSize).not.toHaveBeenCalled()
  })

  it('sizes the canvas from the backend when there is no per-layer state', async () => {
    getCompositorCanvas.mockReturnValue({ w: 1280, h: 1280 })
    const session = makeSession()

    await loadCompositorSession(
      session as unknown as LayerEditorSession,
      node,
      fallbackName
    )

    expect(applyLayerState).not.toHaveBeenCalled()
    expect(session.setCanvasSize).toHaveBeenCalledWith(1280, 1280)
    expect(session.editor.history.clear).toHaveBeenCalled()
    expect(session.fitView).toHaveBeenCalled()
  })

  it('lets the resolved initial state own the canvas over the raw fallback', async () => {
    getCompositorCanvas.mockReturnValue({ w: 1280, h: 1280 })
    resolveInitialLayerState.mockReturnValue({ layers: [] })
    const session = makeSession()

    await loadCompositorSession(
      session as unknown as LayerEditorSession,
      node,
      fallbackName
    )

    expect(applyLayerState).toHaveBeenCalled()
    expect(session.setCanvasSize).not.toHaveBeenCalled()
  })
})
