import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'

import {
  activityInside,
  computeNodePreview,
  previewDisplay,
  setPreviewDisplay
} from './nodePreviewSystem'
import type { PreviewDisplay } from './nodePreviewSystem'

vi.mock(import('@/scripts/app'))

type Sources = Parameters<typeof computeNodePreview>[0]

function item(mediaType: string, filename: string): AugmentedResultItem {
  return { mediaType, filename, nodeId: '7', subfolder: '' }
}

const png = item('images', 'still.png')
const webm = item('video', 'clip.webm')
const flac = item('audio', 'take.flac')
const mp4InImages = item('images', 'legacy.mp4')
const glb = item('3d', 'mesh.glb')
const gif = item('gifs', 'loop.gif')

const unhinted: Sources = {
  source: '7',
  outputs: undefined,
  liveUrls: undefined,
  items: [],
  mediaTypeHint: undefined,
  hasVideoInput: false
}

const media = (type: string, items: AugmentedResultItem[]) => ({
  kind: 'media',
  type,
  items
})

describe(computeNodePreview, () => {
  it.for<{ when: string; sources: Partial<Sources>; parts: unknown[] }>([
    {
      when: 'one run saves images and a video',
      sources: { items: [webm, png] },
      parts: [media('image', [png]), media('video', [webm])]
    },
    {
      when: 'a video is saved under the images bucket',
      sources: {
        outputs: { animated: [true], images: [{ filename: 'legacy.mp4' }] },
        items: [mp4InImages],
        mediaTypeHint: 'image'
      },
      parts: [media('video', [mp4InImages])]
    },
    {
      when: 'a video node also lists still images',
      sources: { items: [png, webm], hasVideoInput: true },
      parts: [media('video', [webm])]
    },
    {
      when: 'a hint the rules do not render meets a VIDEO input',
      sources: { items: [png], hasVideoInput: true, mediaTypeHint: 'model' },
      parts: [media('image', [png])]
    },
    {
      when: 'a GIF is saved under the gifs bucket',
      sources: { items: [gif] },
      parts: [media('image', [gif])]
    },
    {
      when: 'an animated GIF has no video item',
      sources: { outputs: { animated: [true], gifs: [gif] }, items: [gif] },
      parts: [media('image', [gif])]
    },
    {
      when: 'audio sits next to images',
      sources: { items: [flac, png] },
      parts: [media('image', [png]), media('audio', [flac])]
    },
    {
      when: 'an output has no registered kind',
      sources: { items: [glb] },
      parts: []
    },
    {
      when: 'a live frame arrives while earlier outputs exist',
      sources: { items: [png], liveUrls: ['blob:first', 'blob:latest'] },
      parts: [
        { kind: 'live', source: '7', url: 'blob:latest' },
        media('image', [png])
      ]
    }
  ])('splits parts when $when', ({ sources, parts }) => {
    expect(computeNodePreview({ ...unhinted, ...sources })).toEqual(parts)
  })
})

describe(activityInside, () => {
  function arrangeHostWithSources() {
    const rootGraph = createTestRootGraph()
    const definition = createTestSubgraph({ rootGraph })
    for (const id of [10, 11, 12]) {
      const node = new LGraphNode('Sampler')
      node.id = toNodeId(id)
      definition.add(node)
    }
    const host = createTestSubgraphNode(definition, { id: 5 })
    rootGraph.add(host)
    Object.assign(app, { rootGraph })
    return host
  }

  const executionId = (host: number, ...inner: number[]) =>
    createNodeExecutionId([toNodeId(host), ...inner.map(toNodeId)])

  it('shows one part per interior source running in parallel, in a stable order', () => {
    const host = arrangeHostWithSources()
    const store = useNodeOutputStore()
    store.setNodePreviewsByExecutionId(executionId(5, 12), ['blob:twelve'])
    store.setNodePreviewsByExecutionId(executionId(5, 10), ['blob:ten'])
    store.setNodePreviewsByExecutionId(executionId(5), ['blob:twelve'])

    expect(activityInside(host, new Set())).toEqual([
      { kind: 'live', source: '5:10', url: 'blob:ten' },
      { kind: 'live', source: '5:12', url: 'blob:twelve' }
    ])
  })

  it('leaves out a source an exposed preview already shows', () => {
    const host = arrangeHostWithSources()
    const store = useNodeOutputStore()
    store.setNodePreviewsByExecutionId(executionId(5, 10), ['blob:ten'])
    store.setNodePreviewsByExecutionId(executionId(5, 11), ['blob:eleven'])

    expect(activityInside(host, new Set(['5:10']))).toEqual([
      { kind: 'live', source: '5:11', url: 'blob:eleven' }
    ])
  })

  it('shows nothing once the interior frames are gone, even while the host keeps the last one', () => {
    vi.useFakeTimers()
    const host = arrangeHostWithSources()
    const store = useNodeOutputStore()
    store.setNodePreviewsByExecutionId(executionId(5, 10), ['blob:ten'])
    store.setNodePreviewsByExecutionId(executionId(5), ['blob:ten'])

    store.revokePreviewsByExecutionId(executionId(5, 10))
    vi.runAllTimers()

    expect(store.getNodePreviews(host)).toEqual(['blob:ten'])
    expect(activityInside(host, new Set())).toEqual([])
    vi.useRealTimers()
  })
})

describe(previewDisplay, () => {
  it.for<{
    when: string
    chosen: PreviewDisplay
    extensionHides: boolean
    display: PreviewDisplay
  }>([
    {
      when: 'nobody chose',
      chosen: 'auto',
      extensionHides: false,
      display: 'auto'
    },
    {
      when: 'an extension hides output images',
      chosen: 'auto',
      extensionHides: true,
      display: 'hidden'
    },
    {
      when: 'the user reserves a zone on a node an extension hides',
      chosen: 'shown',
      extensionHides: true,
      display: 'shown'
    },
    {
      when: 'the user hides the preview',
      chosen: 'hidden',
      extensionHides: false,
      display: 'hidden'
    }
  ])('is $display when $when', ({ chosen, extensionHides, display }) => {
    const graph = createTestRootGraph()
    const node = new LGraphNode('Preview')
    graph.add(node)
    node.hideOutputImages = extensionHides

    setPreviewDisplay(node, chosen)

    expect(previewDisplay(node)).toBe(display)
    expect(previewDisplay(node, 'exposed preview')).toBe(
      extensionHides ? 'hidden' : 'auto'
    )
  })
})
