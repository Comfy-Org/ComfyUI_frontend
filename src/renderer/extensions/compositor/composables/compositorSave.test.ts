import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultMode } from '@/renderer/extensions/layerEditor/engine/mode'
import type { RasterData } from '@/renderer/extensions/layerEditor/engine/node'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import {
  saveCompositorLayerState,
  saveCompositorPreview
} from './compositorSave'
import {
  clearCompositorLayers,
  getCompositorPreviewOverride,
  setCompositorLayers
} from './useCompositorLayers'

function rasterNode(id: string, name: string): RasterData {
  return {
    id,
    kind: 'raster',
    name,
    visible: true,
    opacity: 0.5,
    mode: defaultMode('multiply'),
    transform: { x: 1, y: 2, w: 16, h: 16, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    contentId: `content-${id}`,
    naturalWidth: 16,
    naturalHeight: 16
  }
}

function makeSession() {
  return {
    editor: {
      render: vi.fn()
    },
    compositor: {
      toBlob: vi.fn(async () => new Blob(['x'], { type: 'image/png' }))
    },
    canvasSize: { value: { w: 64, h: 48 } },
    layers: { value: [rasterNode('a', 'Background')] },
    layerFlips: () => ({ h: true, v: false }),
    inputLayerIds: () => ['a']
  }
}

const GRAPH_ID = 'compositor-save-test'
const NODE_ID = toNodeId(7)

function makeNode(): { node: LGraphNode } {
  useWidgetValueStore().registerWidget(
    widgetId(GRAPH_ID, NODE_ID, 'compositor'),
    { type: 'compositor', value: {}, options: {} }
  )
  const node = createMockLGraphNode({
    id: NODE_ID,
    graph: { rootGraph: { id: GRAPH_ID } }
  })
  return { node }
}

function storedValue(): unknown {
  return useWidgetValueStore().getWidget(
    widgetId(GRAPH_ID, NODE_ID, 'compositor')
  )?.value
}

const cacheNode = createMockLGraphNode({ id: NODE_ID })

beforeEach(() => {
  clearCompositorLayers(cacheNode)
})

function cacheFingerprint() {
  setCompositorLayers(
    cacheNode,
    [{ filename: 'a.png', subfolder: '', type: 'temp' }],
    ['hash-a', 'hash-b']
  )
}

describe('saveCompositorLayerState', () => {
  it('writes the layer state recipe to the compositor widget', () => {
    cacheFingerprint()
    const session = makeSession()
    const { node } = makeNode()

    expect(saveCompositorLayerState(session, node)).toBe(true)

    expect(storedValue()).toMatchObject({
      canvas: { w: 64, h: 48 },
      layers: [
        {
          name: 'Background',
          opacity: 0.5,
          blend: 'multiply',
          flipH: true,
          flipV: false
        }
      ]
    })
  })

  it('embeds the cached inputs fingerprint into the saved state', () => {
    setCompositorLayers(
      cacheNode,
      [{ filename: 'a.png', subfolder: '', type: 'temp' }],
      ['hash-a', 'hash-b']
    )
    const { node } = makeNode()

    saveCompositorLayerState(makeSession(), node)

    expect(storedValue()).toMatchObject({ inputs: ['hash-a', 'hash-b'] })
  })

  it('refuses to save when no fingerprint is cached', () => {
    const { node } = makeNode()

    expect(saveCompositorLayerState(makeSession(), node)).toBe(false)

    expect(useWidgetValueStore().setValue).not.toHaveBeenCalled()
    expect(storedValue()).toEqual({})
  })

  it('keeps widgets untouched when extraction fails', () => {
    cacheFingerprint()
    const session = makeSession()
    session.layerFlips = () => {
      throw new Error('boom')
    }
    const { node } = makeNode()

    expect(saveCompositorLayerState(session, node)).toBe(false)

    expect(useWidgetValueStore().setValue).not.toHaveBeenCalled()
    expect(storedValue()).toEqual({})
  })
})

describe('saveCompositorPreview', () => {
  it('renders the composite and publishes a preview blob URL', async () => {
    const session = makeSession()
    const { node } = makeNode()

    await saveCompositorPreview(session, node)

    expect(session.editor.render).toHaveBeenCalled()
    expect(session.compositor.toBlob).toHaveBeenCalled()
    expect(getCompositorPreviewOverride(node)).toMatch(/^blob:/)
  })

  it('leaves the preview untouched when rendering fails', async () => {
    const session = makeSession()
    session.compositor.toBlob.mockRejectedValueOnce(new Error('boom'))
    const { node } = makeNode()

    await saveCompositorPreview(session, node)

    expect(getCompositorPreviewOverride(node)).toBeUndefined()
  })
})
