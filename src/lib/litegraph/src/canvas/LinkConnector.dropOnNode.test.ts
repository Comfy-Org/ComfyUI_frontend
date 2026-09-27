import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphNode,
  LinkConnector,
  ToInputRenderLink
} from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

/**
 * Multi-group autogrow nodes (e.g. the ByteDance Seedance reference node) stack
 * differently typed inputs next to each other — image_1..N, then video_1, audio_1.
 * Every accepted connection inserts a slot, pushing the neighbouring groups down
 * by one slot pitch, so the next drop easily lands on an incompatible slot.
 */
function createTargetNode(graph: LGraph) {
  const node = new LGraphNode('target')
  node.addInput('image_1', 'IMAGE')
  node.addInput('image_2', 'IMAGE')
  node.addInput('video_1', 'VIDEO')
  node.addInput('audio_1', 'AUDIO')
  node.pos = [200, 0]
  graph.add(node)
  node.updateArea(createMockCanvasRenderingContext2D())
  return node
}

function createSourceNode(graph: LGraph) {
  const node = new LGraphNode('source')
  node.addOutput('IMAGE', 'IMAGE')
  node.pos = [0, 0]
  graph.add(node)
  node.updateArea(createMockCanvasRenderingContext2D())
  return node
}

function dropEventAt(node: LGraphNode, slotIndex: number): CanvasPointerEvent {
  const [canvasX, canvasY] = node.getInputPos(slotIndex)
  return { canvasX, canvasY } as CanvasPointerEvent
}

describe('LinkConnector dropping onto a node', () => {
  let graph: LGraph
  let connector: LinkConnector
  let target: LGraphNode
  let source: LGraphNode

  beforeEach(() => {
    graph = new LGraph()
    connector = new LinkConnector(vi.fn())
    target = createTargetNode(graph)
    source = createSourceNode(graph)

    connector.state.connectingTo = 'input'
    connector.renderLinks.push(
      new ToInputRenderLink(graph, source, source.outputs[0])
    )
  })

  test('connects to the compatible slot when dropped directly on it', () => {
    connector.dropOnNode(target, dropEventAt(target, 1))

    expect(target.inputs[0].link).toBeNull()
    expect(target.inputs[1].link).not.toBeNull()
  })

  test('falls back to a free compatible slot when dropped on an incompatible slot', () => {
    // Aiming at the image group but landing one slot low, on VIDEO.
    connector.dropOnNode(target, dropEventAt(target, 2))

    expect(target.inputs[2].link).toBeNull()
    expect(target.inputs[0].link).not.toBeNull()
  })

  test('preserves an occupied compatible slot when dropped on an incompatible slot', () => {
    target.removeInput(1)
    const existingSource = createSourceNode(graph)
    existingSource.connect(0, target, 0)
    const existingLink = target.inputs[0].link

    connector.dropOnNode(target, dropEventAt(target, 1))

    expect(target.inputs[0].link).toBe(existingLink)
    expect(target.inputs[1].link).toBeNull()
  })

  test('discards the link when the node has no compatible slot at all', () => {
    const incompatible = new LGraphNode('incompatible')
    incompatible.addInput('video_1', 'VIDEO')
    incompatible.pos = [400, 0]
    graph.add(incompatible)
    incompatible.updateArea(createMockCanvasRenderingContext2D())

    connector.dropOnNode(incompatible, dropEventAt(incompatible, 0))

    expect(incompatible.inputs[0].link).toBeNull()
  })
})
