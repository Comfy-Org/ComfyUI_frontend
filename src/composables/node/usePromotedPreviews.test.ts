import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
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

import { CANVAS_IMAGE_PREVIEW_WIDGET } from './canvasImagePreviewTypes'
import { usePromotedPreviews } from './usePromotedPreviews'

function createSetup() {
  const subgraph = createTestSubgraph()
  const subgraphNode = createTestSubgraphNode(subgraph)
  return { subgraph, subgraphNode }
}

function addInteriorNode(
  setup: ReturnType<typeof createSetup>,
  options: {
    id: number
    previewMediaType?: 'image' | 'video' | 'audio' | 'model'
  } = { id: 10 }
): LGraphNode {
  const node = new LGraphNode('test')
  node.id = toNodeId(options.id)
  if (options.previewMediaType) {
    node.previewMediaType = options.previewMediaType
  }
  setup.subgraph.add(node)
  return node
}

function seedOutputs(
  subgraphId: string,
  nodeIds: Array<number | string>,
  filename = 'output.png'
) {
  const store = useNodeOutputStore()
  for (const nodeId of nodeIds) {
    const locatorId = createNodeLocatorId(subgraphId, toNodeId(nodeId))
    store.nodeOutputs[locatorId] = {
      images: [{ filename }]
    }
  }
}

function outputItems(...filenames: string[]) {
  return filenames.map((filename) => expect.objectContaining({ filename }))
}

function seedPreviewImages(
  subgraphId: string,
  entries: Array<{ nodeId: number | string; urls: string[] }>
) {
  const store = useNodeOutputStore()
  for (const { nodeId, urls } of entries) {
    const locatorId = createNodeLocatorId(subgraphId, toNodeId(nodeId))
    store.nodePreviewImages[locatorId] = urls
  }
}

function exposePreview(
  setup: ReturnType<typeof createSetup>,
  sourceNodeId: string,
  sourcePreviewName = CANVAS_IMAGE_PREVIEW_WIDGET
) {
  const hostLocator = getPreviewExposureHostLocator(setup.subgraphNode)
  expect(hostLocator).not.toBeNull()
  if (!hostLocator) return
  usePreviewExposureStore().addExposure(
    setup.subgraphNode.rootGraph.id,
    hostLocator,
    { sourceNodeId, sourcePreviewName }
  )
}

interface ArrangeOptions {
  id?: number
  previewMediaType?: 'image' | 'video' | 'audio' | 'model'
  filename?: string
}

function arrangePromotedPreview(options: ArrangeOptions = {}) {
  const { id = 10, previewMediaType, filename = 'output.png' } = options
  const setup = createSetup()
  addInteriorNode(setup, { id, previewMediaType })
  exposePreview(setup, String(id))
  seedOutputs(setup.subgraph.id, [id], filename)
  return { setup, items: outputItems(filename) }
}

describe(usePromotedPreviews, () => {
  it('returns empty array for non-SubgraphNode', () => {
    const node = new LGraphNode('test')
    const { promotedPreviews } = usePromotedPreviews(() => node)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array for null node', () => {
    const { promotedPreviews } = usePromotedPreviews(() => null)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array (does not throw) when SubgraphNode is detached', () => {
    const setup = createSetup()
    const parentGraph = setup.subgraphNode.graph!
    parentGraph.add(setup.subgraphNode)
    parentGraph.remove(setup.subgraphNode)

    expect(setup.subgraphNode.graph).toBeNull()
    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(() => promotedPreviews.value).not.toThrow()
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array when no $$ promotions exist', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns image preview for promoted $$ widget with outputs', () => {
    const { setup, items } = arrangePromotedPreview({
      previewMediaType: 'image'
    })

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        items
      }
    ])
  })

  it('returns video type when interior node has video previewMediaType', () => {
    const { setup } = arrangePromotedPreview({
      previewMediaType: 'video',
      filename: 'output.webm'
    })

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value[0].type).toBe('video')
  })

  it('defaults preview type to image when previewMediaType is unset', () => {
    const { setup, items } = arrangePromotedPreview()

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      expect.objectContaining({ type: 'image', items })
    ])
  })

  it('returns separate entries for multiple promoted $$ widgets', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    addInteriorNode(setup, { id: 20, previewMediaType: 'image' })
    exposePreview(setup, '10')
    exposePreview(setup, '20')

    seedOutputs(setup.subgraph.id, [10], 'a.png')
    seedOutputs(setup.subgraph.id, [20], 'b.png')

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toHaveLength(2)
    expect(promotedPreviews.value[0].items).toEqual(outputItems('a.png'))
    expect(promotedPreviews.value[1].items).toEqual(outputItems('b.png'))
  })

  it('returns preview when only nodePreviewImages exist (e.g. GLSL live preview)', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    exposePreview(setup, '10')

    const blobUrl = 'blob:http://localhost/glsl-preview'
    seedPreviewImages(setup.subgraph.id, [
      { nodeId: toNodeId(10), urls: [blobUrl] }
    ])
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([blobUrl])

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        urls: [blobUrl]
      }
    ])
  })

  it('recomputes when preview images are populated after first evaluation', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    exposePreview(setup, '10')

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([])

    const blobUrl = 'blob:http://localhost/glsl-preview'
    seedPreviewImages(setup.subgraph.id, [
      { nodeId: toNodeId(10), urls: [blobUrl] }
    ])
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([blobUrl])

    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        urls: [blobUrl]
      }
    ])
  })

  it('skips interior nodes with no image output', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })
    exposePreview(setup, '10')

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('skips missing interior nodes', () => {
    const setup = createSetup()
    exposePreview(setup, '99')

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('renders leaf media exposed through a nested subgraph host', () => {
    const innerSetup = createSetup()
    const leafNode = addInteriorNode(innerSetup, {
      id: 10,
      previewMediaType: 'image'
    })

    const outerSetup = createSetup()
    const innerHost = createTestSubgraphNode(innerSetup.subgraph, { id: 20 })
    outerSetup.subgraph.add(innerHost)

    const store = usePreviewExposureStore()
    const innerHostLocator = getPreviewExposureHostLocator(innerHost)
    const outerHostLocator = getPreviewExposureHostLocator(
      outerSetup.subgraphNode
    )
    expect(innerHostLocator).not.toBeNull()
    expect(outerHostLocator).not.toBeNull()
    if (!innerHostLocator || !outerHostLocator) return
    store.addExposure(outerSetup.subgraphNode.rootGraph.id, innerHostLocator, {
      sourceNodeId: String(leafNode.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })
    store.addExposure(outerSetup.subgraphNode.rootGraph.id, outerHostLocator, {
      sourceNodeId: String(innerHost.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })

    seedOutputs(innerSetup.subgraph.id, [leafNode.id], 'leaf.png')

    const { promotedPreviews } = usePromotedPreviews(
      () => outerSetup.subgraphNode
    )
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        items: outputItems('leaf.png')
      }
    ])
  })

  it('keeps promoted previews distinct for multiple instances of a shared subgraph definition', () => {
    const innerSetup = createSetup()
    const leafNode = addInteriorNode(innerSetup, {
      id: 10,
      previewMediaType: 'image'
    })

    const outerSetup = createSetup()
    const innerHost = createTestSubgraphNode(innerSetup.subgraph, { id: 20 })
    outerSetup.subgraph.add(innerHost)
    const firstHost = createTestSubgraphNode(outerSetup.subgraph, { id: 11 })
    const secondHost = createTestSubgraphNode(outerSetup.subgraph, { id: 12 })
    const firstHostLocator = String(firstHost.id)
    const secondHostLocator = String(secondHost.id)
    const nestedLocator = getPreviewExposureHostLocator(innerHost)
    expect(nestedLocator).not.toBeNull()
    if (!nestedLocator) return
    const firstLeafExecutionId = `${firstHostLocator}:${innerHost.id}:${leafNode.id}`
    const secondLeafExecutionId = `${secondHostLocator}:${innerHost.id}:${leafNode.id}`

    const store = usePreviewExposureStore()
    store.addExposure(firstHost.rootGraph.id, firstHostLocator, {
      sourceNodeId: String(innerHost.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })
    store.addExposure(firstHost.rootGraph.id, secondHostLocator, {
      sourceNodeId: String(innerHost.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })
    store.addExposure(firstHost.rootGraph.id, nestedLocator, {
      sourceNodeId: String(leafNode.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })

    const outputStore = useNodeOutputStore()
    vi.mocked(outputStore.getNodePreviewImagesByExecutionId).mockImplementation(
      (executionId) => {
        if (executionId === firstLeafExecutionId) return ['blob:first']
        if (executionId === secondLeafExecutionId) return ['blob:second']
        return undefined
      }
    )
    vi.mocked(outputStore.getNodeImageUrlsByExecutionId).mockImplementation(
      (executionId) => {
        if (executionId === firstLeafExecutionId) return ['blob:first']
        if (executionId === secondLeafExecutionId) return ['blob:second']
        return undefined
      }
    )

    expect(usePromotedPreviews(() => firstHost).promotedPreviews.value).toEqual(
      [
        {
          sourceNodeId: '10',
          sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
          type: 'image',
          urls: ['blob:first']
        }
      ]
    )
    expect(
      usePromotedPreviews(() => secondHost).promotedPreviews.value
    ).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        urls: ['blob:second']
      }
    ])
  })
})
