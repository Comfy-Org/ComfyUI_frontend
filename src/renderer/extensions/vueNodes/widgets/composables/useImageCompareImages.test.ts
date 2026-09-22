import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { useImageCompareImages } from './useImageCompareImages'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { apiURL: (path: string) => `/api${path}` }
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    rootGraph: undefined,
    getRandParam: () => '',
    getPreviewFormatParam: () => '',
    nodeOutputs: {},
    nodePreviewImages: {}
  }
}))

function buildGraph() {
  const graph = new LGraph()

  const compare = new LGraphNode('ImageCompare')
  compare.addInput('image_a', 'IMAGE')
  compare.addInput('image_b', 'IMAGE')
  graph.add(compare)

  const producerA = new LGraphNode('LoadImage')
  producerA.addOutput('IMAGE', 'IMAGE')
  graph.add(producerA)

  const producerB = new LGraphNode('LoadImage')
  producerB.addOutput('IMAGE', 'IMAGE')
  graph.add(producerB)

  return { graph, compare, producerA, producerB }
}

describe('useImageCompareImages', () => {
  let outputStore: ReturnType<typeof useNodeOutputStore>

  beforeEach(() => {
    outputStore = useNodeOutputStore()
    outputStore.resetAllOutputsAndPreviews()
  })

  it('shows the producer images as soon as an input is connected', () => {
    const { compare, producerA } = buildGraph()
    outputStore.nodeOutputs[String(producerA.id)] = {
      images: [{ filename: 'source.png', type: 'input' }]
    }

    const { beforeImages } = useImageCompareImages(computed(() => compare))
    expect(beforeImages.value).toEqual([])

    producerA.connect(0, compare, 0)

    expect(beforeImages.value).toEqual([
      '/api/view?filename=source.png&type=input'
    ])
  })

  it('keeps each input on its own side of the slider', () => {
    const { compare, producerA, producerB } = buildGraph()
    producerA.connect(0, compare, 0)
    producerB.connect(0, compare, 1)
    outputStore.nodeOutputs[String(producerA.id)] = {
      images: [{ filename: 'a.png', type: 'input' }]
    }
    outputStore.nodeOutputs[String(producerB.id)] = {
      images: [{ filename: 'b.png', type: 'input' }]
    }

    const { beforeImages, afterImages } = useImageCompareImages(
      computed(() => compare)
    )

    expect(beforeImages.value).toEqual(['/api/view?filename=a.png&type=input'])
    expect(afterImages.value).toEqual(['/api/view?filename=b.png&type=input'])
  })

  it('exposes every image of a batched producer', () => {
    const { compare, producerA } = buildGraph()
    producerA.connect(0, compare, 0)
    outputStore.nodeOutputs[String(producerA.id)] = {
      images: [
        { filename: 'a1.png', type: 'input' },
        { filename: 'a2.png', type: 'input' }
      ]
    }

    const { beforeImages } = useImageCompareImages(computed(() => compare))

    expect(beforeImages.value).toEqual([
      '/api/view?filename=a1.png&type=input',
      '/api/view?filename=a2.png&type=input'
    ])
  })

  it('falls back to the images saved by its own run when the producer has none', () => {
    const { compare, producerA } = buildGraph()
    producerA.connect(0, compare, 0)
    outputStore.nodeOutputs[String(compare.id)] = {
      a_images: [{ filename: 'compare_a.png', type: 'temp' }],
      b_images: [{ filename: 'compare_b.png', type: 'temp' }]
    }

    const { beforeImages, afterImages } = useImageCompareImages(
      computed(() => compare)
    )

    expect(beforeImages.value).toEqual([
      '/api/view?filename=compare_a.png&type=temp'
    ])
    expect(afterImages.value).toEqual([
      '/api/view?filename=compare_b.png&type=temp'
    ])
  })

  it('prefers a connected producer over the images saved by its own run', () => {
    const { compare, producerA } = buildGraph()
    producerA.connect(0, compare, 0)
    outputStore.nodeOutputs[String(producerA.id)] = {
      images: [{ filename: 'live.png', type: 'input' }]
    }
    outputStore.nodeOutputs[String(compare.id)] = {
      a_images: [{ filename: 'stale.png', type: 'temp' }]
    }

    const { beforeImages } = useImageCompareImages(computed(() => compare))

    expect(beforeImages.value).toEqual([
      '/api/view?filename=live.png&type=input'
    ])
  })

  it('survives the output reset a workflow switch performs', () => {
    const { compare } = buildGraph()
    outputStore.nodeOutputs[String(compare.id)] = {
      a_images: [{ filename: 'compare_a.png', type: 'temp' }]
    }
    const { beforeImages } = useImageCompareImages(computed(() => compare))
    const snapshot = outputStore.snapshotOutputs()

    outputStore.resetAllOutputsAndPreviews()
    expect(beforeImages.value).toEqual([])

    outputStore.restoreOutputs(snapshot)

    expect(beforeImages.value).toEqual([
      '/api/view?filename=compare_a.png&type=temp'
    ])
  })

  it('resolves a producer that sits behind a subgraph boundary', () => {
    const { graph, compare } = buildGraph()
    const subgraph = createTestSubgraph({
      rootGraph: graph,
      outputs: [{ name: 'IMAGE', type: 'IMAGE' }]
    })
    const inner = new LGraphNode('LoadImage')
    inner.addOutput('IMAGE', 'IMAGE')
    subgraph.add(inner)
    subgraph.outputNode.slots[0].connect(inner.outputs[0], inner)

    const subgraphNode = createTestSubgraphNode(subgraph, {
      parentGraph: graph
    })
    graph.add(subgraphNode)
    subgraphNode.connect(0, compare, 0)

    outputStore.nodeOutputs[`${subgraph.id}:${inner.id}`] = {
      images: [{ filename: 'inner.png', type: 'input' }]
    }

    const { beforeImages } = useImageCompareImages(computed(() => compare))

    expect(beforeImages.value).toEqual([
      '/api/view?filename=inner.png&type=input'
    ])
  })

  it('has nothing to show while the node is unconnected and unrun', () => {
    const { compare } = buildGraph()

    const { beforeImages, afterImages } = useImageCompareImages(
      computed(() => compare)
    )

    expect(beforeImages.value).toEqual([])
    expect(afterImages.value).toEqual([])
  })
})
