import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultMode } from 'pentrado/engine'
import type { RasterData } from 'pentrado/engine'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toNodeId } from '@/types/nodeId'

import type { CompositorLayerState } from './compositorLayerState'
import {
  clearCompositorLayers,
  getCompositorPreviewOverride,
  setCompositorLayers
} from './useCompositorLayers'
import { useCompositorSaver } from './useCompositorSaver'

const { toastAdd, closeDialog } = vi.hoisted(() => ({
  toastAdd: vi.fn(),
  closeDialog: vi.fn()
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog })
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: toastAdd })
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

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
      render: vi.fn(),
      floating: vi.fn<() => unknown>(() => null),
      anchorFloating: vi.fn()
    },
    compositor: {
      toBlob: vi.fn(async () => new Blob(['x'], { type: 'image/png' }))
    },
    canvasSize: { value: { w: 64, h: 48 } },
    layers: { value: [rasterNode('a', 'Background')] },
    layerFlips: () => ({ h: true, v: false })
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
    widgets_values: [{}],
    graph: { setDirtyCanvas: vi.fn() }
  } as unknown as LGraphNode
  return { node, compositorWidget }
}

function widgetValue(widget: IBaseWidget): CompositorLayerState {
  return widget.value as CompositorLayerState
}

describe('useCompositorSaver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCompositorLayers(toNodeId(7))
  })

  it('writes the layer state recipe to the compositor widget', async () => {
    const session = makeSession()
    const { node, compositorWidget } = makeNode()

    const result = await useCompositorSaver().saveComposite(session, node)

    expect(result).toBe(true)
    expect(session.editor.render).toHaveBeenCalled()
    expect(session.compositor.toBlob).toHaveBeenCalled()

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

    expect(node.graph?.setDirtyCanvas).toHaveBeenCalled()
    expect(closeDialog).toHaveBeenCalledWith({ key: 'global-layer-editor' })
    expect(toastAdd).not.toHaveBeenCalled()
    expect(getCompositorPreviewOverride(node.id)).toMatch(/^blob:/)
  })

  it('embeds the cached inputs fingerprint into the saved state', async () => {
    setCompositorLayers(
      toNodeId(7),
      [{ filename: 'a.png', subfolder: '', type: 'temp' }],
      ['hash-a', 'hash-b']
    )
    const { node, compositorWidget } = makeNode()

    await useCompositorSaver().saveComposite(makeSession(), node)

    expect(widgetValue(compositorWidget).inputs).toEqual(['hash-a', 'hash-b'])
  })

  it('omits inputs from the saved state when no fingerprint is cached', async () => {
    const { node, compositorWidget } = makeNode()

    await useCompositorSaver().saveComposite(makeSession(), node)

    expect('inputs' in widgetValue(compositorWidget)).toBe(false)
  })

  it('anchors a floating selection before rendering', async () => {
    const session = makeSession()
    session.editor.floating.mockReturnValue({})
    const { node } = makeNode()

    await useCompositorSaver().saveComposite(session, node)

    expect(session.editor.anchorFloating).toHaveBeenCalled()
  })

  it('keeps widgets untouched and the dialog open when rendering fails', async () => {
    const session = makeSession()
    session.compositor.toBlob.mockRejectedValueOnce(new Error('boom'))
    const { node, compositorWidget } = makeNode()

    const result = await useCompositorSaver().saveComposite(session, node)

    expect(result).toBe(false)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'compositor.saveFailed'
      })
    )
    expect(closeDialog).not.toHaveBeenCalled()
    expect(compositorWidget.value).toEqual({})
    expect(node.widgets_values).toEqual([{}])
  })
})
