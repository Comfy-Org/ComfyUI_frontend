import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { api } from '@/scripts/api'

import { useVideoSourceUrl } from './useVideoSourceUrl'

let outputStore: ReturnType<typeof useNodeOutputStore>
let widgetStore: ReturnType<typeof useWidgetValueStore>

vi.mock(import('@/scripts/api'))

vi.mock(import('@/scripts/app'))

vi.mock(import('@/platform/distribution/cloudPreviewUtil'), () => ({
  appendCloudResParam: vi.fn()
}))

function fakeNode(overrides: Record<string, unknown> = {}): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: 'node',
    graph: { rootGraph: { id: 'graph' } },
    inputs: [],
    widgets: [],
    isSubgraphNode: () => false,
    getInputLink: () => null,
    ...overrides
  })
}

function mountSource(node: LGraphNode) {
  let source!: ReturnType<typeof useVideoSourceUrl>
  const view = render(
    defineComponent({
      setup() {
        source = useVideoSourceUrl(computed(() => node))
        return () => h('div')
      }
    })
  )
  return { ...source, unmount: view.unmount }
}

describe('useVideoSourceUrl', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    outputStore = useNodeOutputStore()
    widgetStore = useWidgetValueStore()
    for (const key of Object.keys(outputStore.nodeOutputs)) {
      delete outputStore.nodeOutputs[key]
    }
    for (const key of Object.keys(outputStore.nodePreviewImages)) {
      delete outputStore.nodePreviewImages[key]
    }
  })

  it('restores the previous onConnectionsChange on unmount', () => {
    const original = vi.fn()
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => null,
      onConnectionsChange: original
    })

    const { unmount } = mountSource(node)
    expect(node.onConnectionsChange).not.toBe(original)

    unmount()

    expect(node.onConnectionsChange).toBe(original)
  })

  it('recovers when the input link appears after mount', async () => {
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      '/api/view?filename=out.mp4&type=temp&rand=0.5'
    ])
    vi.mocked(widgetStore.getWidget).mockReturnValue(undefined)
    const upstream = fakeNode({ id: 'upstream' })
    let connected = false
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => (connected ? upstream : null)
    })

    const { videoUrl } = mountSource(node)
    expect(videoUrl.value).toBeUndefined()

    connected = true
    outputStore.nodeOutputs['upstream'] = { images: [{ filename: 'out.mp4' }] }
    const fireConnectionsChange = fromAny<() => void, unknown>(
      node.onConnectionsChange
    )
    fireConnectionsChange()
    await nextTick()

    expect(videoUrl.value).toBe('/api/view?filename=out.mp4&type=temp')
  })

  it('switches from the file widget to the executed preview when outputs arrive', async () => {
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue(undefined)
    vi.mocked(widgetStore.getWidget).mockReturnValue(
      fromPartial<NonNullable<ReturnType<typeof widgetStore.getWidget>>>({
        value: 'clip.mp4'
      })
    )

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl } = mountSource(node)
    expect(videoUrl.value).toContain('filename=clip.mp4')

    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      '/api/view?filename=out.mp4&type=temp'
    ])
    outputStore.nodeOutputs['up'] = { images: [{ filename: 'out.mp4' }] }
    await nextTick()

    expect(videoUrl.value).toBe('/api/view?filename=out.mp4&type=temp')
  })

  it('prefers upstream outputs and strips the rand cache-buster', () => {
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      '/api/view?filename=out.mp4&type=temp&rand=0.123'
    ])
    vi.mocked(widgetStore.getWidget).mockReturnValue(undefined)

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toBe('/api/view?filename=out.mp4&type=temp')
  })

  it('re-emits the resolved url after a load error', async () => {
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      '/api/view?filename=out.mp4&type=temp&rand=0.123'
    ])
    vi.mocked(widgetStore.getWidget).mockReturnValue(undefined)

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl, status, onError } = mountSource(node)
    const history = [videoUrl.value]
    watch(videoUrl, (value) => history.push(value), { flush: 'sync' })

    onError()
    await vi.advanceTimersByTimeAsync(500)

    expect(history.slice(-2)).toEqual([
      undefined,
      '/api/view?filename=out.mp4&type=temp'
    ])
    expect(status.value).toBe('loading')
  })

  it('resets the retry budget when the source node re-executes with a new filename', async () => {
    outputStore.nodeOutputs['up'] = { images: [{ filename: 'out.mp4' }] }
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      '/api/view?filename=out.mp4&type=temp&rand=0.123'
    ])
    vi.mocked(widgetStore.getWidget).mockReturnValue(undefined)

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl, status, onError } = mountSource(node)

    onError()
    expect(status.value).toBe('retrying')

    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      '/api/view?filename=new.mp4&type=temp&rand=0.456'
    ])
    outputStore.nodeOutputs['up'] = { images: [{ filename: 'new.mp4' }] }
    await nextTick()

    expect(videoUrl.value).toBe('/api/view?filename=new.mp4&type=temp')
    expect(status.value).toBe('loading')
  })

  it('re-arms, reloads and resets the budget when a re-execution resolves the identical url', async () => {
    const url = '/api/view?filename=out.mp4&type=temp'
    outputStore.nodeOutputs['up'] = { images: [{ filename: 'out.mp4' }] }
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      `${url}&rand=0.123`
    ])
    vi.mocked(widgetStore.getWidget).mockReturnValue(undefined)

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl, status, onError } = mountSource(node)
    onError()
    await vi.advanceTimersByTimeAsync(500)
    onError()

    const history = [videoUrl.value]
    watch(videoUrl, (value) => history.push(value), { flush: 'sync' })

    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      `${url}&rand=0.456`
    ])
    outputStore.nodeOutputs['up'] = { images: [{ filename: 'out.mp4' }] }
    await nextTick()
    await nextTick()

    expect(history.slice(-2)).toEqual([undefined, url])
    expect(status.value).toBe('loading')

    const historyLength = history.length
    onError()
    await vi.advanceTimersByTimeAsync(500)

    expect(history.slice(historyLength)).toEqual([undefined, url])
  })

  it('does not reload when an unrelated connection change resolves the same url', async () => {
    const url = '/api/view?filename=out.mp4&type=temp'
    outputStore.nodeOutputs['up'] = { images: [{ filename: 'out.mp4' }] }
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      `${url}&rand=0.123`
    ])
    vi.mocked(widgetStore.getWidget).mockReturnValue(undefined)

    const upstream = fakeNode({ id: 'up' })
    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => upstream
    })

    const { videoUrl, status } = mountSource(node)
    const history = [videoUrl.value]
    watch(videoUrl, (value) => history.push(value), { flush: 'sync' })

    const fireConnectionsChange = node.onConnectionsChange as () => void
    fireConnectionsChange()
    await nextTick()
    await nextTick()

    expect(history).toEqual([url])
    expect(status.value).toBe('loading')
  })

  it('falls back to the upstream file widget before any execution', () => {
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue(undefined)
    vi.mocked(widgetStore.getWidget).mockReturnValue(
      fromPartial<NonNullable<ReturnType<typeof widgetStore.getWidget>>>({
        value: 'clip.mp4'
      })
    )

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
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue([
      '/api/view?filename=already-trimmed.mp4&type=temp'
    ])
    vi.mocked(widgetStore.getWidget).mockReturnValue(
      fromPartial<NonNullable<ReturnType<typeof widgetStore.getWidget>>>({
        value: 'raw.mp4'
      })
    )

    const node = fakeNode()

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toContain('filename=raw.mp4')
  })

  it('resolves nothing when the video input is not linked', () => {
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue(undefined)
    vi.mocked(widgetStore.getWidget).mockReturnValue(undefined)

    const node = fakeNode({
      inputs: [{ name: 'video' }],
      getInputNode: () => null
    })

    const { videoUrl } = mountSource(node)

    expect(videoUrl.value).toBeUndefined()
  })

  it('resolves through a subgraph output to the inner source node', () => {
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue(undefined)
    vi.mocked(widgetStore.getWidget).mockReturnValue(
      fromPartial<NonNullable<ReturnType<typeof widgetStore.getWidget>>>({
        value: 'inner.mp4'
      })
    )

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
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue(undefined)
    vi.mocked(widgetStore.getWidget).mockReturnValue(
      fromPartial<NonNullable<ReturnType<typeof widgetStore.getWidget>>>({
        value: 'deep.mp4'
      })
    )

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
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue(undefined)
    vi.mocked(widgetStore.getWidget).mockReturnValue(
      fromPartial<NonNullable<ReturnType<typeof widgetStore.getWidget>>>({
        value: 'loop.mp4'
      })
    )

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
    vi.mocked(outputStore.getNodeImageUrls).mockReturnValue(undefined)
    vi.mocked(widgetStore.getWidget).mockReturnValue(
      fromPartial<NonNullable<ReturnType<typeof widgetStore.getWidget>>>({
        value: 'inner.mp4'
      })
    )

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
