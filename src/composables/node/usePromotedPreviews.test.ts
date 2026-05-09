import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import { usePromotedPreviews } from './usePromotedPreviews'

type MockNodeOutputStore = Pick<
  ReturnType<typeof useNodeOutputStore>,
  | 'nodeOutputs'
  | 'nodeOutputsByExecutionId'
  | 'nodePreviewImages'
  | 'nodePreviewImagesByExecutionId'
  | 'getNodeImageUrls'
  | 'getNodeImageUrlsByExecutionId'
>

const getNodeImageUrls = vi.hoisted(() =>
  vi.fn<MockNodeOutputStore['getNodeImageUrls']>()
)
const getNodeImageUrlsByExecutionId = vi.hoisted(() =>
  vi.fn<MockNodeOutputStore['getNodeImageUrlsByExecutionId']>()
)
const useNodeOutputStoreMock = vi.hoisted(() =>
  vi.fn<() => MockNodeOutputStore>()
)

vi.mock('@/stores/nodeOutputStore', () => {
  return {
    useNodeOutputStore: useNodeOutputStoreMock
  }
})

function createMockNodeOutputStore(): MockNodeOutputStore {
  return {
    nodeOutputs: reactive<MockNodeOutputStore['nodeOutputs']>({}),
    nodeOutputsByExecutionId: reactive<
      MockNodeOutputStore['nodeOutputsByExecutionId']
    >({}),
    nodePreviewImages: reactive<MockNodeOutputStore['nodePreviewImages']>({}),
    nodePreviewImagesByExecutionId: reactive<
      MockNodeOutputStore['nodePreviewImagesByExecutionId']
    >({}),
    getNodeImageUrls,
    getNodeImageUrlsByExecutionId
  }
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
  node.id = options.id
  if (options.previewMediaType) {
    node.previewMediaType = options.previewMediaType
  }
  setup.subgraph.add(node)
  return node
}

function seedOutputs(subgraphId: string, nodeIds: Array<number | string>) {
  const store = useNodeOutputStore()
  for (const nodeId of nodeIds) {
    const locatorId = createNodeLocatorId(subgraphId, nodeId)
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
    const locatorId = createNodeLocatorId(subgraphId, nodeId)
    store.nodePreviewImages[locatorId] = urls
  }
}

function exposePreview(
  setup: ReturnType<typeof createSetup>,
  sourceNodeId: string,
  sourcePreviewName = '$$canvas-image-preview'
) {
  usePreviewExposureStore().addExposure(
    setup.subgraphNode.rootGraph.id,
    createNodeLocatorId(setup.subgraphNode.rootGraph.id, setup.subgraphNode.id),
    { sourceNodeId, sourcePreviewName }
  )
}

describe(usePromotedPreviews, () => {
  let nodeOutputStore: MockNodeOutputStore

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    getNodeImageUrls.mockReset()
    getNodeImageUrlsByExecutionId.mockReset()

    nodeOutputStore = createMockNodeOutputStore()
    useNodeOutputStoreMock.mockReturnValue(nodeOutputStore)
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
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'image' })
    exposePreview(setup, '10')

    const mockUrls = ['/view?filename=output.png']
    seedOutputs(setup.subgraph.id, [10])
    getNodeImageUrls.mockReturnValue(mockUrls)

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: '$$canvas-image-preview',
        type: 'image',
        urls: mockUrls
      }
    ])
  })

  it('returns video type when interior node has video previewMediaType', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'video' })
    exposePreview(setup, '10')

    seedOutputs(setup.subgraph.id, [10])
    getNodeImageUrls.mockReturnValue(['/view?filename=output.webm'])

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value[0].type).toBe('video')
  })

  it('returns audio type when interior node has audio previewMediaType', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10, previewMediaType: 'audio' })
    exposePreview(setup, '10')

    seedOutputs(setup.subgraph.id, [10])
    getNodeImageUrls.mockReturnValue(['/view?filename=output.mp3'])

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value[0].type).toBe('audio')
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
    getNodeImageUrls.mockImplementation((node: LGraphNode) => {
      if (node === node10) return ['/view?a=1']
      if (node === node20) return ['/view?b=2']
      return undefined
    })

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
    getNodeImageUrls.mockReturnValue([blobUrl])

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: '$$canvas-image-preview',
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
    getNodeImageUrls.mockReturnValue([blobUrl])

    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: '$$canvas-image-preview',
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

  it('uses preview exposures by source preview name', () => {
    const setup = createSetup()
    addInteriorNode(setup, { id: 10 })
    exposePreview(setup, '10')

    const mockUrls = ['/view?filename=img.png']
    seedOutputs(setup.subgraph.id, [10])
    getNodeImageUrls.mockReturnValue(mockUrls)

    const { promotedPreviews } = usePromotedPreviews(() => setup.subgraphNode)
    expect(promotedPreviews.value).toHaveLength(1)
    expect(promotedPreviews.value[0].urls).toEqual(mockUrls)
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
    store.addExposure(
      outerSetup.subgraphNode.rootGraph.id,
      String(innerHost.id),
      {
        sourceNodeId: String(leafNode.id),
        sourcePreviewName: '$$canvas-image-preview'
      }
    )
    store.addExposure(
      outerSetup.subgraphNode.rootGraph.id,
      createNodeLocatorId(
        outerSetup.subgraphNode.rootGraph.id,
        outerSetup.subgraphNode.id
      ),
      {
        sourceNodeId: String(innerHost.id),
        sourcePreviewName: '$$canvas-image-preview'
      }
    )

    const mockUrls = ['/view?filename=leaf.png']
    seedOutputs(innerSetup.subgraph.id, [leafNode.id])
    getNodeImageUrls.mockImplementation((node: LGraphNode) =>
      node === leafNode ? mockUrls : []
    )

    const { promotedPreviews } = usePromotedPreviews(
      () => outerSetup.subgraphNode
    )
    expect(promotedPreviews.value).toEqual([
      {
        sourceNodeId: '10',
        sourceWidgetName: '$$canvas-image-preview',
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
    const innerHost = createTestSubgraphNode(innerSetup.subgraph, { id: 20 })
    outerSetup.subgraph.add(innerHost)
    const firstHost = createTestSubgraphNode(outerSetup.subgraph, { id: 11 })
    const secondHost = createTestSubgraphNode(outerSetup.subgraph, { id: 12 })

    const store = usePreviewExposureStore()
    store.addExposure(firstHost.rootGraph.id, '11', {
      sourceNodeId: String(innerHost.id),
      sourcePreviewName: '$$canvas-image-preview'
    })
    store.addExposure(firstHost.rootGraph.id, '12', {
      sourceNodeId: String(innerHost.id),
      sourcePreviewName: '$$canvas-image-preview'
    })
    store.addExposure(firstHost.rootGraph.id, '11:20', {
      sourceNodeId: String(leafNode.id),
      sourcePreviewName: '$$canvas-image-preview'
    })
    store.addExposure(firstHost.rootGraph.id, '12:20', {
      sourceNodeId: String(leafNode.id),
      sourcePreviewName: '$$canvas-image-preview'
    })

    nodeOutputStore.nodePreviewImagesByExecutionId['11:20:10'] = ['blob:first']
    nodeOutputStore.nodePreviewImagesByExecutionId['12:20:10'] = ['blob:second']
    getNodeImageUrlsByExecutionId.mockImplementation((executionId) => {
      if (executionId === '11:20:10') return ['blob:first']
      if (executionId === '12:20:10') return ['blob:second']
      return undefined
    })

    expect(usePromotedPreviews(() => firstHost).promotedPreviews.value).toEqual(
      [
        {
          sourceNodeId: '10',
          sourceWidgetName: '$$canvas-image-preview',
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
        sourceWidgetName: '$$canvas-image-preview',
        type: 'image',
        urls: ['blob:second']
      }
    ])
  })
})
