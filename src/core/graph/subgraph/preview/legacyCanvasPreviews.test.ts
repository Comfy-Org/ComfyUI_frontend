import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CANVAS_IMAGE_PREVIEW_WIDGET } from '@/composables/node/canvasImagePreviewTypes'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  getPreviewExposureHostLocator,
  usePreviewExposureStore
} from '@/stores/previewExposureStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import { syncLegacyPreviewWidgets } from './legacyCanvasPreviews'

function setupExposedHost() {
  const subgraph = createTestSubgraph()
  const host = createTestSubgraphNode(subgraph)
  const interior = new LGraphNode('KSampler')
  interior.id = toNodeId(10)
  subgraph.add(interior)

  const store = usePreviewExposureStore()
  const hostLocator = getPreviewExposureHostLocator(host)
  if (!hostLocator) throw new Error('missing host locator')
  store.addExposure(host.rootGraph.id, hostLocator, {
    sourceNodeId: '10',
    sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
  })
  return { host, interior, store, hostLocator }
}

function previewRowNames(host: ReturnType<typeof createTestSubgraphNode>) {
  return host.widgets
    .filter((widget) => widget.name.startsWith('$$promoted-preview-'))
    .map((widget) => widget.name)
}

describe('legacyCanvasPreviews', () => {
  beforeEach(() => {
    LiteGraph.vueNodesMode = false
  })

  it('creates a preview row per exposure in legacy rendering', () => {
    const { host } = setupExposedHost()

    syncLegacyPreviewWidgets(host)

    expect(previewRowNames(host)).toEqual([
      `$$promoted-preview-10:${CANVAS_IMAGE_PREVIEW_WIDGET}`
    ])
    expect(host.widgets[0]?.serialize).toBe(false)
  })

  it('keeps the same widget instance across syncs', () => {
    const { host } = setupExposedHost()
    syncLegacyPreviewWidgets(host)
    const [first] = host.widgets

    syncLegacyPreviewWidgets(host)

    expect(host.widgets).toEqual([first])
  })

  it('removes the rows when exposure is withdrawn', () => {
    const { host, store, hostLocator } = setupExposedHost()
    syncLegacyPreviewWidgets(host)

    store.removeExposure(
      host.rootGraph.id,
      hostLocator,
      CANVAS_IMAGE_PREVIEW_WIDGET
    )
    syncLegacyPreviewWidgets(host)

    expect(previewRowNames(host)).toEqual([])
  })

  it('tears the rows down when Nodes 2.0 is enabled', () => {
    const { host } = setupExposedHost()
    syncLegacyPreviewWidgets(host)

    LiteGraph.vueNodesMode = true
    syncLegacyPreviewWidgets(host)

    expect(previewRowNames(host)).toEqual([])
  })

  it('does not load a completed-output URL in the preview row', () => {
    const { host } = setupExposedHost()
    useNodeOutputStore().nodeOutputs[
      createNodeLocatorId(host.subgraph.id, toNodeId(10))
    ] = { images: [{ filename: 'gone.png' }] }
    const loadImageSpy = vi
      .spyOn(host, 'loadImage')
      .mockReturnValue({} as HTMLImageElement)
    syncLegacyPreviewWidgets(host)

    const [row] = host.widgets
    row?.draw?.({} as CanvasRenderingContext2D, host, 100, 0, 250)

    expect(loadImageSpy).not.toHaveBeenCalled()
  })

  it('loads the interior canvas-image URL in the preview row', () => {
    const { host, interior } = setupExposedHost()
    interior.imgs = [{ src: 'blob:final' } as HTMLImageElement]
    const loadImageSpy = vi
      .spyOn(host, 'loadImage')
      .mockReturnValue({} as HTMLImageElement)
    syncLegacyPreviewWidgets(host)

    const [row] = host.widgets
    row?.draw?.({} as CanvasRenderingContext2D, host, 100, 0, 250)

    expect(loadImageSpy).toHaveBeenCalledWith('blob:final')
  })
})
