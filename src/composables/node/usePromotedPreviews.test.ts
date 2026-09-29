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

function seedOutputs(subgraphId: string, nodeIds: Array<number | string>) {
  const store = useNodeOutputStore()
  for (const nodeId of nodeIds) {
    const locatorId = createNodeLocatorId(subgraphId, toNodeId(nodeId))
    store.nodeOutputs[locatorId] = {
      images: [{ filename: 'output.png' }]
    }
  }
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
  urls?: string[]
}

function arrangePromotedPreview(options: ArrangeOptions = {}) {
  const {
    id = 10,
    previewMediaType,
    urls = ['/view?filename=output.png']
  } = options
  const setup = createSetup()
  addInteriorNode(setup, { id, previewMediaType })
  exposePreview(setup, String(id))
  seedOutputs(setup.subgraph.id, [id])
  const images = urls.map((url) => ({
    url,
    result: { filename: 'output.png' }
  }))
  vi.mocked(useNodeOutputStore().getNodeImages).mockReturnValue(images)
  vi.mocked(useNodeOutputStore().getNodeImagesByExecutionId).mockReturnValue(
    images
  )
  return { setup, images }
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
    const { setup, images } = arrangePromotedPreview({
      previewMediaType: 'image'
    })

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        images
      }
    ])
  })

  it.for([
    ['video', '/view?filename=output.webm'],
    ['audio', '/view?filename=output.mp3']
  ] as const)(
    'returns %s type when interior node has %s previewMediaType',
    ([mediaType, url]) => {
      const { setup } = arrangePromotedPreview({
        previewMediaType: mediaType,
        urls: [url]
      })

      const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
      expect(promotedPreviews.value[0].type).toBe(mediaType)
    }
  )

  it('defaults preview type to image when previewMediaType is unset', () => {
    const { setup, images } = arrangePromotedPreview()

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      expect.objectContaining({ type: 'image', images })
    ])
  })

  it('returns separate entries for multiple promoted $$ widgets', () => {
    const setup = createSetup()
    const node10 = addInteriorNode(setup, {
      id: 10,
      previewMediaType: 'image'
    })
    const node20 = addInteriorNode(setup, {
      id: 20,
      previewMediaType: 'image'
    })
    exposePreview(setup, '10')
    exposePreview(setup, '20')

    seedOutputs(setup.subgraph.id, [10, 20])
    vi.mocked(useNodeOutputStore().getNodeImages).mockImplementation(
      (node: LGraphNode) => {
        if (node === node10) return [{ url: '/view?a=1' }]
        if (node === node20) return [{ url: '/view?b=2' }]
        return undefined
      }
    )

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toHaveLength(2)
    expect(promotedPreviews.value[0]).toMatchObject({
      images: [{ url: '/view?a=1' }]
    })
    expect(promotedPreviews.value[1]).toMatchObject({
      images: [{ url: '/view?b=2' }]
    })
  })

  it('returns preview when only nodePreviewImages exist (e.g. GLSL live preview)', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    exposePreview(setup, '10')

    const blobUrl = 'blob:http://localhost/glsl-preview'
    seedPreviewImages(setup.subgraph.id, [
      { nodeId: toNodeId(10), urls: [blobUrl] }
    ])
    vi.mocked(useNodeOutputStore().getNodeImages).mockReturnValue([
      { url: blobUrl }
    ])

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        images: [{ url: blobUrl }]
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
    vi.mocked(useNodeOutputStore().getNodeImages).mockReturnValue([
      { url: blobUrl }
    ])

    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        images: [{ url: blobUrl }]
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

    const mockUrls = ['/view?filename=leaf.png']
    seedOutputs(innerSetup.subgraph.id, [leafNode.id])
    vi.mocked(useNodeOutputStore().getNodeImages).mockImplementation(
      (node: LGraphNode) =>
        node === leafNode
          ? [{ url: mockUrls[0], result: { filename: 'output.png' } }]
          : []
    )

    const { promotedPreviews } = usePromotedPreviews(
      () => outerSetup.subgraphNode
    )
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        images: [{ url: mockUrls[0], result: { filename: 'output.png' } }]
      }
    ])
  })

  it('carries the leaf records, not the host node records', () => {
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
    if (!innerHostLocator || !outerHostLocator) {
      throw new Error('Expected preview exposure locators for both hosts')
    }
    store.addExposure(outerSetup.subgraphNode.rootGraph.id, innerHostLocator, {
      sourceNodeId: String(leafNode.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })
    store.addExposure(outerSetup.subgraphNode.rootGraph.id, outerHostLocator, {
      sourceNodeId: String(innerHost.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })

    const outputStore = useNodeOutputStore()
    const leafLocator = createNodeLocatorId(innerSetup.subgraph.id, leafNode.id)
    const hostLocator = createNodeLocatorId(
      outerSetup.subgraph.id,
      outerSetup.subgraphNode.id
    )
    outputStore.nodeOutputs[leafLocator] = {
      images: [{ filename: 'leaf.png' }]
    }
    outputStore.nodeOutputs[hostLocator] = {
      images: [{ filename: 'host.webm' }]
    }
    vi.mocked(outputStore.getNodeImages).mockImplementation(
      (node: LGraphNode) =>
        node === leafNode
          ? [
              {
                url: '/view?filename=leaf.png',
                result: { filename: 'leaf.png' }
              }
            ]
          : []
    )

    const { promotedPreviews } = usePromotedPreviews(
      () => outerSetup.subgraphNode
    )

    expect(promotedPreviews.value[0]).toMatchObject({
      images: [{ result: { filename: 'leaf.png' } }]
    })
  })

  it('pairs execution output urls with execution records, not locator records', () => {
    const { setup } = arrangePromotedPreview({ previewMediaType: 'image' })
    const outputStore = useNodeOutputStore()
    const interiorLocator = createNodeLocatorId(setup.subgraph.id, toNodeId(10))
    outputStore.nodeOutputs[interiorLocator] = {
      images: [{ filename: 'locator.png' }]
    }
    vi.mocked(outputStore.getNodeImagesByExecutionId).mockReturnValue([
      {
        url: '/view?filename=execution.png',
        result: { filename: 'execution.png' }
      }
    ])

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)

    expect(promotedPreviews.value[0]).toMatchObject({
      images: [{ result: { filename: 'execution.png' } }]
    })
  })

  it('carries no records when the execution url is a live preview', () => {
    const { setup } = arrangePromotedPreview({ previewMediaType: 'image' })
    const outputStore = useNodeOutputStore()
    const interiorLocator = createNodeLocatorId(setup.subgraph.id, toNodeId(10))
    outputStore.nodeOutputs[interiorLocator] = {
      images: [{ filename: 'locator.png' }]
    }
    vi.mocked(outputStore.getNodePreviewImagesByExecutionId).mockReturnValue([
      'blob:live'
    ])
    vi.mocked(outputStore.getNodeImagesByExecutionId).mockReturnValue([
      { url: 'blob:live' }
    ])

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)

    expect(promotedPreviews.value[0]).toMatchObject({
      images: [{ url: 'blob:live' }]
    })
    expect(promotedPreviews.value[0]).not.toHaveProperty('images.0.result')
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
    vi.mocked(outputStore.getNodeImagesByExecutionId).mockImplementation(
      (executionId) => {
        if (executionId === firstLeafExecutionId) return [{ url: 'blob:first' }]
        if (executionId === secondLeafExecutionId)
          return [{ url: 'blob:second' }]
        return undefined
      }
    )

    expect(usePromotedPreviews(() => firstHost).promotedPreviews.value).toEqual(
      [
        {
          sourceNodeId: '10',
          sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
          type: 'image',
          images: [{ url: 'blob:first' }]
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
        images: [{ url: 'blob:second' }]
      }
    ])
  })
})
