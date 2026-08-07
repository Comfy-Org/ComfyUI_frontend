import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import { loadCompositorSession } from './compositorSession'

const { applyLayerState, getCompositorLayers, resolveInitialLayerState } =
  vi.hoisted(() => ({
    applyLayerState: vi.fn(),
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
    fitView: vi.fn()
  }
}

const node = { id: toNodeId(3) } as unknown as LGraphNode
const fallbackName = (i: number) => `Layer ${i + 1}`

describe('loadCompositorSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCompositorLayers.mockReturnValue([])
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
  })
})
