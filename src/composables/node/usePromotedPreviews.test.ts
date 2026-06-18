import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, asNodeId } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import { CANVAS_IMAGE_PREVIEW_WIDGET } from './canvasImagePreviewTypes'
import { usePromotedPreviews } from './usePromotedPreviews'

type MockNodeOutputStore = Pick<
  ReturnType<typeof useNodeOutputStore>,
  | 'nodeOutputs'
  | 'nodePreviewImages'
  | 'getNodeImageUrls'
  | 'getNodeImageUrlsByExecutionId'
  | 'getNodeOutputByExecutionId'
  | 'getNodePreviewImagesByExecutionId'
>

vi.mock('@/stores/nodeOutputStore', () => {
  const store: MockNodeOutputStore = {
    nodeOutputs: reactive<MockNodeOutputStore['nodeOutputs']>({}),
    nodePreviewImages: reactive<MockNodeOutputStore['nodePreviewImages']>({}),
    getNodeImageUrls: vi.fn(),
    getNodeImageUrlsByExecutionId: vi.fn(),
    getNodeOutputByExecutionId: vi.fn(),
    getNodePreviewImagesByExecutionId: vi.fn()
  }
  return { useNodeOutputStore: () => store }
})

function clearMockNodeOutputStore() {
  const { nodeOutputs, nodePreviewImages } = useNodeOutputStore()
  for (const key of Object.keys(nodeOutputs)) delete nodeOutputs[key]
  for (const key of Object.keys(nodePreviewImages))
    delete nodePreviewImages[key]
}

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
  node.id = asNodeId(options.id)
  if (options.previewMediaType) {
    node.previewMediaType = options.previewMediaType
  }
  setup.subgraph.add(node)
  return node
}

function seedOutputs(subgraphId: string, nodeIds: Array<number | string>) {
  const store = useNodeOutputStore()
  for (const nodeId of nodeIds) {
    const locatorId = createNodeLocatorId(subgraphId, asNodeId(nodeId))
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
    const locatorId = createNodeLocatorId(subgraphId, asNodeId(nodeId))
    store.nodePreviewImages[locatorId] = urls
  }
}

function exposePreview(
  setup: ReturnType<typeof createSetup>,
  sourceNodeId: string,
  sourcePreviewName = CANVAS_IMAGE_PREVIEW_WIDGET
) {
  usePreviewExposureStore().addExposure(
    setup.subgraphNode.rootGraph.id,
    String(setup.subgraphNode.id),
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
  vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue(urls)
  return { setup, urls }
}

describe(usePromotedPreviews, () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    clearMockNodeOutputStore()
  })

  it('returns empty array for non-SubgraphNode', () => {
    const node = new LGraphNode('test')
    const { promotedPreviews } = usePromotedPreviews(() => node)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array for null node', () => {
    const { promotedPreviews } = usePromotedPreviews(() => null)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns empty array when no $$ promotions exist', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([])
  })

  it('returns image preview for promoted $$ widget with outputs', () => {
    const { setup, urls } = arrangePromotedPreview({
      previewMediaType: 'image'
    })

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        urls
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
    const { setup, urls } = arrangePromotedPreview()

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      expect.objectContaining({ type: 'image', urls })
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
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockImplementation(
      (node: LGraphNode) => {
        if (node === node10) return ['/view?a=1']
        if (node === node20) return ['/view?b=2']
        return undefined
      }
    )

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toHaveLength(2)
    expect(promotedPreviews.value[0].urls).toEqual(['/view?a=1'])
    expect(promotedPreviews.value[1].urls).toEqual(['/view?b=2'])
  })

  it('returns preview when only nodePreviewImages exist (e.g. GLSL live preview)', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    exposePreview(setup, '10')

    const blobUrl = 'blob:http://localhost/glsl-preview'
    seedPreviewImages(setup.subgraph.id, [{ nodeId: 10, urls: [blobUrl] }])
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
    seedPreviewImages(setup.subgraph.id, [{ nodeId: 10, urls: [blobUrl] }])
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
    const innerHost = createTestSubgraphNode(innerSetup.subgraph, {
      id: asNodeId(20)
    })
    outerSetup.subgraph.add(innerHost)

    const store = usePreviewExposureStore()
    store.addExposure(
      outerSetup.subgraphNode.rootGraph.id,
      String(innerHost.id),
      {
        sourceNodeId: String(leafNode.id),
        sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
      }
    )
    store.addExposure(
      outerSetup.subgraphNode.rootGraph.id,
      String(outerSetup.subgraphNode.id),
      {
        sourceNodeId: String(innerHost.id),
        sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
      }
    )

    const mockUrls = ['/view?filename=leaf.png']
    seedOutputs(innerSetup.subgraph.id, [leafNode.id])
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockImplementation(
      (node: LGraphNode) => (node === leafNode ? mockUrls : [])
    )

    const { promotedPreviews } = usePromotedPreviews(
      () => outerSetup.subgraphNode
    )
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
        type: 'image',
        urls: mockUrls
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
    const innerHost = createTestSubgraphNode(innerSetup.subgraph, {
      id: asNodeId(20)
    })
    outerSetup.subgraph.add(innerHost)
    const firstHost = createTestSubgraphNode(outerSetup.subgraph, {
      id: asNodeId(11)
    })
    const secondHost = createTestSubgraphNode(outerSetup.subgraph, {
      id: asNodeId(12)
    })
    const firstHostLocator = String(firstHost.id)
    const secondHostLocator = String(secondHost.id)
    const firstNestedLocator = `${firstHostLocator}:${innerHost.id}`
    const secondNestedLocator = `${secondHostLocator}:${innerHost.id}`
    const firstLeafExecutionId = `${firstNestedLocator}:${leafNode.id}`
    const secondLeafExecutionId = `${secondNestedLocator}:${leafNode.id}`

    const store = usePreviewExposureStore()
    store.addExposure(firstHost.rootGraph.id, firstHostLocator, {
      sourceNodeId: String(innerHost.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })
    store.addExposure(firstHost.rootGraph.id, secondHostLocator, {
      sourceNodeId: String(innerHost.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })
    store.addExposure(firstHost.rootGraph.id, firstNestedLocator, {
      sourceNodeId: String(leafNode.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })
    store.addExposure(firstHost.rootGraph.id, secondNestedLocator, {
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
