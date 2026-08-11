import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultMode } from '@/renderer/extensions/layerEditor/engine/mode'
import type { RasterData } from '@/renderer/extensions/layerEditor/engine/node'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toNodeId } from '@/types/nodeId'

import type { CompositorLayerState } from './compositorLayerState'
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

function makeNode() {
  const compositorWidget = {
    name: 'compositor',
    value: {},
    callback: vi.fn()
  } as unknown as IBaseWidget
  const node = {
    id: toNodeId(7),
    widgets: [compositorWidget],
    widgets_values: [{}]
  } as unknown as LGraphNode
  return { node, compositorWidget }
}

function widgetValue(widget: IBaseWidget): CompositorLayerState {
  return widget.value as CompositorLayerState
}

const cacheNode = { id: toNodeId(7) } as unknown as LGraphNode

beforeEach(() => {
  vi.clearAllMocks()
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
    const { node, compositorWidget } = makeNode()

    expect(saveCompositorLayerState(session, node)).toBe(true)

    const savedState = widgetValue(compositorWidget)
    expect(compositorWidget.callback).toHaveBeenCalledWith(savedState)
    expect(node.widgets_values?.[0]).toBe(compositorWidget.value)

    expect(savedState.canvas).toEqual({ w: 64, h: 48 })
    expect(savedState.layers).toHaveLength(1)
    expect(savedState.layers[0]).toMatchObject({
      name: 'Background',
      opacity: 0.5,
      blend: 'multiply',
      flipH: true,
      flipV: false
    })
  })

  it('embeds the cached inputs fingerprint into the saved state', () => {
    setCompositorLayers(
      cacheNode,
      [{ filename: 'a.png', subfolder: '', type: 'temp' }],
      ['hash-a', 'hash-b']
    )
    const { node, compositorWidget } = makeNode()

    saveCompositorLayerState(makeSession(), node)

    expect(widgetValue(compositorWidget).inputs).toEqual(['hash-a', 'hash-b'])
  })

  it('refuses to save when no fingerprint is cached', () => {
    const { node, compositorWidget } = makeNode()

    expect(saveCompositorLayerState(makeSession(), node)).toBe(false)

    expect(compositorWidget.callback).not.toHaveBeenCalled()
    expect(node.widgets_values).toEqual([{}])
  })

  it('keeps widgets untouched when extraction fails', () => {
    cacheFingerprint()
    const session = makeSession()
    session.layerFlips = () => {
      throw new Error('boom')
    }
    const { node, compositorWidget } = makeNode()

    expect(saveCompositorLayerState(session, node)).toBe(false)

    expect(compositorWidget.callback).not.toHaveBeenCalled()
    expect(compositorWidget.value).toEqual({})
    expect(node.widgets_values).toEqual([{}])
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
