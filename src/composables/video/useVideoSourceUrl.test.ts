import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { useVideoSourceUrl } from './useVideoSourceUrl'

const mocks = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { reactive } = require('vue')
  return {
    nodeOutputs: reactive({}) as Record<string, unknown>,
    nodePreviewImages: reactive({}) as Record<string, unknown>,
    getNodeImageUrls: vi.fn<(node: unknown) => string[] | undefined>(),
    getWidget: vi.fn()
  }
})

vi.mock('@/scripts/api', () => ({
  api: { apiURL: (path: string) => `/api${path}` }
}))

vi.mock('@/scripts/app', () => ({
  app: { getPreviewFormatParam: () => '' }
}))

vi.mock('@/platform/distribution/cloudPreviewUtil', () => ({
  appendCloudResParam: vi.fn()
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    nodeToNodeLocatorId: (node: { id: string }) => String(node.id)
  })
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    nodeOutputs: mocks.nodeOutputs,
    nodePreviewImages: mocks.nodePreviewImages,
    getNodeImageUrls: mocks.getNodeImageUrls
  })
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({
    getWidget: mocks.getWidget
  })
}))

function fakeNode(overrides: Record<string, unknown> = {}): LGraphNode {
  return {
    id: 'node',
    graph: { rootGraph: { id: 'graph' } },
    inputs: [],
    widgets: [],
    isSubgraphNode: () => false,
    getInputLink: () => null,
    ...overrides
  } as unknown as LGraphNode
}

function mountSource(node: LGraphNode) {
  let videoUrl!: ReturnType<typeof useVideoSourceUrl>['videoUrl']
  render(
    defineComponent({
      setup() {
        videoUrl = useVideoSourceUrl(computed(() => node)).videoUrl
        return () => h('div')
      }
    })
  )
  return { videoUrl }
}

describe('useVideoSourceUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mocks.nodeOutputs)) {
      delete mocks.nodeOutputs[key]
    }
    for (const key of Object.keys(mocks.nodePreviewImages)) {
      delete mocks.nodePreviewImages[key]
    }
  })

  it('switches from the file widget to the executed preview when outputs arrive', async () => {
    mocks.getNodeImageUrls.mockReturnValue(undefined)
    mocks.getWidget.mockReturnValue({ value: 'clip.mp4' })

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl } = mountSource(node)
    expect(videoUrl.value).toContain('filename=clip.mp4')

    mocks.getNodeImageUrls.mockReturnValue([
      '/api/view?filename=out.mp4&type=temp'
    ])
    mocks.nodeOutputs['up'] = { images: [{ filename: 'out.mp4' }] }
    await nextTick()

    expect(videoUrl.value).toBe('/api/view?filename=out.mp4&type=temp')
  })

  it('prefers upstream outputs and strips the rand cache-buster', () => {
    mocks.getNodeImageUrls.mockReturnValue([
      '/api/view?filename=out.mp4&type=temp&rand=0.123'
    ])
    mocks.getWidget.mockReturnValue(undefined)

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toBe('/api/view?filename=out.mp4&type=temp')
  })

  it('falls back to the upstream file widget before any execution', () => {
    mocks.getNodeImageUrls.mockReturnValue(undefined)
    mocks.getWidget.mockReturnValue({ value: 'clip.mp4' })

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toContain('/api/view?')
    expect(videoUrl.value).toContain('filename=clip.mp4')
  })

  it('uses the node itself as source when there is no video input', () => {
    mocks.getNodeImageUrls.mockReturnValue([
      '/api/view?filename=already-trimmed.mp4&type=temp'
    ])
    mocks.getWidget.mockReturnValue({ value: 'raw.mp4' })

    const node = fakeNode()

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toContain('filename=raw.mp4')
  })

  it('resolves nothing when the video input is not linked', () => {
    mocks.getNodeImageUrls.mockReturnValue(undefined)
    mocks.getWidget.mockReturnValue(undefined)

    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => null
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toBeUndefined()
  })

  it('resolves through a subgraph output to the inner source node', () => {
    mocks.getNodeImageUrls.mockReturnValue(undefined)
    mocks.getWidget.mockReturnValue({ value: 'inner.mp4' })

    const innerNode = fakeNode({ id: 'inner' })
    const subgraphNode = fakeNode({
      id: 'sub',
      isSubgraphNode: () => true,
      resolveSubgraphOutputLink: () => ({ outputNode: innerNode })
    })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => subgraphNode,
      getInputLink: () => ({ origin_slot: 0 })
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toContain('filename=inner.mp4')
  })

  it('resolves through nested subgraph outputs to the innermost source node', () => {
    mocks.getNodeImageUrls.mockReturnValue(undefined)
    mocks.getWidget.mockReturnValue({ value: 'deep.mp4' })

    const innerNode = fakeNode({ id: 'inner' })
    const innerSubgraphNode = fakeNode({
      id: 'inner-sub',
      isSubgraphNode: () => true,
      resolveSubgraphOutputLink: () => ({
        outputNode: innerNode,
        link: { origin_slot: 0 }
      })
    })
    const outerSubgraphNode = fakeNode({
      id: 'outer-sub',
      isSubgraphNode: () => true,
      resolveSubgraphOutputLink: () => ({
        outputNode: innerSubgraphNode,
        link: { origin_slot: 1 }
      })
    })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => outerSubgraphNode,
      getInputLink: () => ({ origin_slot: 0 })
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toContain('filename=deep.mp4')
  })

  it('resolves nothing when subgraph resolution loops back on itself', () => {
    mocks.getNodeImageUrls.mockReturnValue(undefined)
    mocks.getWidget.mockReturnValue({ value: 'loop.mp4' })

    const loopingSubgraphNode = fakeNode({
      id: 'loop-sub',
      isSubgraphNode: () => true
    })
    Object.assign(loopingSubgraphNode, {
      resolveSubgraphOutputLink: () => ({
        outputNode: loopingSubgraphNode,
        link: { origin_slot: 0 }
      })
    })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => loopingSubgraphNode,
      getInputLink: () => ({ origin_slot: 0 })
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toBeUndefined()
  })

  it('resolves nothing when the subgraph link is missing', () => {
    mocks.getNodeImageUrls.mockReturnValue(undefined)
    mocks.getWidget.mockReturnValue({ value: 'inner.mp4' })

    const subgraphNode = fakeNode({
      id: 'sub',
      isSubgraphNode: () => true
    })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => subgraphNode,
      getInputLink: () => null
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toBeUndefined()
  })
})
