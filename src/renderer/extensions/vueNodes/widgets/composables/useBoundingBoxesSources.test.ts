import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { BoundingBox } from '@/types/boundingBoxes'

import { useBoundingBoxesSources } from './useBoundingBoxesSources'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

function buildGraph() {
  const graph = new LGraph()

  const target = new LGraphNode('CreateBoundingBoxes')
  target.addInput('background', 'IMAGE')
  target.addInput('bboxes', 'BOUNDING_BOX')
  graph.add(target)

  const image = new LGraphNode('LoadImage')
  image.addOutput('IMAGE', 'IMAGE')
  graph.add(image)

  const boxes = new LGraphNode('BoxProducer')
  boxes.addOutput('BOUNDING_BOX', 'BOUNDING_BOX')
  graph.add(boxes)

  return { graph, target, image, boxes }
}

const box = (x: number): BoundingBox => ({
  x,
  y: 0,
  width: 64,
  height: 64,
  metadata: { type: 'obj', text: '', desc: '', palette: [] }
})

describe('useBoundingBoxesSources', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    useNodeOutputStore().resetAllOutputsAndPreviews()
  })

  it('tracks whether the background input is connected', () => {
    const { target, image } = buildGraph()
    const { backgroundConnected } = useBoundingBoxesSources(
      computed(() => target)
    )
    expect(backgroundConnected.value).toBe(false)

    image.connect(0, target, 0)
    expect(backgroundConnected.value).toBe(true)

    target.disconnectInput(0)
    expect(backgroundConnected.value).toBe(false)
  })

  describe('backgroundUrl', () => {
    it('shows the producer image as soon as the background is connected', () => {
      const { target, image } = buildGraph()
      useNodeOutputStore().nodeOutputs[String(image.id)] = {
        images: [{ filename: 'bg.png', type: 'input' }]
      }

      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))
      expect(backgroundUrl.value).toBeUndefined()

      image.connect(0, target, 0)

      expect(backgroundUrl.value).toBe('/api/view?filename=bg.png&type=input')
    })

    it('drops the background once the input is disconnected', () => {
      const { target, image } = buildGraph()
      image.connect(0, target, 0)
      useNodeOutputStore().nodeOutputs[String(image.id)] = {
        images: [{ filename: 'bg.png', type: 'input' }]
      }
      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))
      expect(backgroundUrl.value).toBeDefined()

      target.disconnectInput(0)

      expect(backgroundUrl.value).toBeUndefined()
    })

    it('follows the producer when it is re-run', () => {
      const { target, image } = buildGraph()
      image.connect(0, target, 0)
      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))

      useNodeOutputStore().nodeOutputs[String(image.id)] = {
        images: [{ filename: 'second.png', type: 'temp' }]
      }

      expect(backgroundUrl.value).toBe(
        '/api/view?filename=second.png&type=temp'
      )
    })

    it.for([
      {
        name: 'the producer preview over the saved background',
        connected: true,
        preview: true,
        saved: true,
        expected: '/api/view?filename=live.png&type=input'
      },
      {
        name: 'the saved background when the producer has no preview',
        connected: true,
        preview: false,
        saved: true,
        expected: '/api/view?filename=bg_saved.png&type=temp'
      },
      {
        name: 'nothing when neither has an image',
        connected: true,
        preview: false,
        saved: false,
        expected: undefined
      },
      {
        name: 'nothing from the saved background once disconnected',
        connected: false,
        preview: false,
        saved: true,
        expected: undefined
      }
    ])('shows $name', ({ connected, preview, saved, expected }) => {
      const { target, image } = buildGraph()
      if (connected) image.connect(0, target, 0)
      if (preview)
        useNodeOutputStore().nodeOutputs[String(image.id)] = {
          images: [{ filename: 'live.png', type: 'input' }]
        }
      if (saved)
        useNodeOutputStore().nodeOutputs[String(target.id)] = {
          background_images: [{ filename: 'bg_saved.png', type: 'temp' }]
        }

      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))

      expect(backgroundUrl.value).toBe(expected)
    })

    it('only falls back to the saved background while its producer is connected', () => {
      const { graph, target, image } = buildGraph()
      const other = new LGraphNode('VAEDecode')
      other.addOutput('IMAGE', 'IMAGE')
      graph.add(other)
      image.connect(0, target, 0)
      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))
      useNodeOutputStore().nodeOutputs[String(target.id)] = {
        background_images: [{ filename: 'from_image.png', type: 'temp' }]
      }
      const saved = '/api/view?filename=from_image.png&type=temp'
      expect(backgroundUrl.value).toBe(saved)

      other.connect(0, target, 0)
      expect(backgroundUrl.value).toBeUndefined()

      image.connect(0, target, 0)
      expect(backgroundUrl.value).toBe(saved)
    })

    it('keeps the same URL when an unrelated link changes', () => {
      const { graph, target, image, boxes } = buildGraph()
      let rand = 0
      vi.spyOn(app, 'getRandParam').mockImplementation(() => `&rand=${++rand}`)
      image.connect(0, target, 0)
      useNodeOutputStore().nodeOutputs[String(image.id)] = {
        images: [{ filename: 'bg.png', type: 'input' }]
      }
      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))
      const before = backgroundUrl.value

      const consumer = new LGraphNode('Consumer')
      consumer.addInput('bboxes', 'BOUNDING_BOX')
      graph.add(consumer)
      boxes.connect(0, consumer, 0)

      expect(backgroundUrl.value).toBe(before)
    })

    it('resolves a producer that sits behind a subgraph boundary', () => {
      const { graph, target } = buildGraph()
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
      subgraphNode.connect(0, target, 0)

      useNodeOutputStore().nodeOutputs[`${subgraph.id}:${inner.id}`] = {
        images: [{ filename: 'inner.png', type: 'input' }]
      }

      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))

      expect(backgroundUrl.value).toBe(
        '/api/view?filename=inner.png&type=input'
      )
    })

    it('picks up a producer connected inside the subgraph after mount', () => {
      const { graph, target } = buildGraph()
      const subgraph = createTestSubgraph({
        rootGraph: graph,
        outputs: [{ name: 'IMAGE', type: 'IMAGE' }]
      })
      const inner = new LGraphNode('LoadImage')
      inner.addOutput('IMAGE', 'IMAGE')
      subgraph.add(inner)
      const subgraphNode = createTestSubgraphNode(subgraph, {
        parentGraph: graph
      })
      graph.add(subgraphNode)
      subgraphNode.connect(0, target, 0)
      useNodeOutputStore().nodeOutputs[`${subgraph.id}:${inner.id}`] = {
        images: [{ filename: 'inner.png', type: 'input' }]
      }
      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))
      expect(backgroundUrl.value).toBeUndefined()

      subgraph.outputNode.slots[0].connect(inner.outputs[0], inner)

      expect(backgroundUrl.value).toBe(
        '/api/view?filename=inner.png&type=input'
      )
    })

    it('survives the output reset a workflow switch performs', () => {
      const { target, image } = buildGraph()
      image.connect(0, target, 0)
      useNodeOutputStore().nodeOutputs[String(image.id)] = {
        images: [{ filename: 'bg.png', type: 'input' }]
      }
      const { backgroundUrl } = useBoundingBoxesSources(computed(() => target))
      const snapshot = useNodeOutputStore().snapshotOutputs()

      useNodeOutputStore().resetAllOutputsAndPreviews()
      expect(backgroundUrl.value).toBeUndefined()

      useNodeOutputStore().restoreOutputs(snapshot)

      expect(backgroundUrl.value).toBe('/api/view?filename=bg.png&type=input')
    })
  })

  describe('incomingBoxes', () => {
    it.for([
      { name: 'the input is connected', connect: true, expected: [box(0)] },
      {
        name: 'the input is not connected',
        connect: false,
        expected: undefined
      }
    ])(
      'reads the boxes echoed by its own run only when $name',
      ({ connect, expected }) => {
        const { target, boxes } = buildGraph()
        if (connect) boxes.connect(0, target, 1)
        useNodeOutputStore().nodeOutputs[String(target.id)] = {
          input_bboxes: [box(0)]
        }

        const { incomingBoxes } = useBoundingBoxesSources(
          computed(() => target)
        )

        expect(incomingBoxes.value).toEqual(expected)
      }
    )

    it.for([
      { name: 'an empty list', output: [] },
      { name: 'an invalid box', output: [box(0), { x: 1 }] }
    ])('ignores $name', ({ output }) => {
      const { target, boxes } = buildGraph()
      boxes.connect(0, target, 1)
      useNodeOutputStore().nodeOutputs[String(target.id)] = {
        input_bboxes: output
      }

      const { incomingBoxes } = useBoundingBoxesSources(computed(() => target))

      expect(incomingBoxes.value).toBeUndefined()
    })

    it('updates when a later run echoes new boxes', () => {
      const { target, boxes } = buildGraph()
      boxes.connect(0, target, 1)
      const { incomingBoxes } = useBoundingBoxesSources(computed(() => target))
      expect(incomingBoxes.value).toBeUndefined()

      useNodeOutputStore().nodeOutputs[String(target.id)] = {
        input_bboxes: [box(32)]
      }

      expect(incomingBoxes.value).toEqual([box(32)])
    })
  })
})
