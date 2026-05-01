import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LinkConnector } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { LinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'

const dropEvent = (x: number, y: number) =>
  ({
    canvasX: x,
    canvasY: y
  }) as Partial<CanvasPointerEvent> as CanvasPointerEvent

const buildAdapter = (network: LGraph) => {
  const linkConnector = new LinkConnector(vi.fn())
  const adapter = new LinkConnectorAdapter(network, linkConnector)
  const dropOnIoNode = vi
    .spyOn(linkConnector, 'dropOnIoNode')
    .mockImplementation(() => {})
  const dropOnNothing = vi
    .spyOn(linkConnector, 'dropOnNothing')
    .mockImplementation(() => {})
  return { adapter, dropOnIoNode, dropOnNothing }
}

describe('LinkConnectorAdapter#dropOnCanvas', () => {
  beforeEach(resetSubgraphFixtureState)

  it('routes drops over the input boundary to dropOnIoNode', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'in', type: 'NUMBER' }]
    })
    subgraph.inputNode.arrange()
    const { adapter, dropOnIoNode, dropOnNothing } = buildAdapter(subgraph)
    const r = subgraph.inputNode.boundingRect
    const event = dropEvent(r[0] + r[2] / 2, r[1] + r[3] / 2)

    adapter.dropOnCanvas(event)

    expect(dropOnIoNode).toHaveBeenCalledTimes(1)
    expect(dropOnIoNode).toHaveBeenCalledWith(subgraph.inputNode, event)
    expect(dropOnNothing).not.toHaveBeenCalled()
  })

  it('routes drops over the output boundary to dropOnIoNode', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'out', type: 'NUMBER' }]
    })
    subgraph.outputNode.arrange()
    const { adapter, dropOnIoNode, dropOnNothing } = buildAdapter(subgraph)
    const r = subgraph.outputNode.boundingRect
    const event = dropEvent(r[0] + r[2] / 2, r[1] + r[3] / 2)

    adapter.dropOnCanvas(event)

    expect(dropOnIoNode).toHaveBeenCalledTimes(1)
    expect(dropOnIoNode).toHaveBeenCalledWith(subgraph.outputNode, event)
    expect(dropOnNothing).not.toHaveBeenCalled()
  })

  it('falls through to dropOnNothing when the pointer is outside any IO node', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'out', type: 'NUMBER' }]
    })
    subgraph.outputNode.arrange()
    const { adapter, dropOnIoNode, dropOnNothing } = buildAdapter(subgraph)
    const event = dropEvent(-9999, -9999)

    adapter.dropOnCanvas(event)

    expect(dropOnIoNode).not.toHaveBeenCalled()
    expect(dropOnNothing).toHaveBeenCalledTimes(1)
    expect(dropOnNothing).toHaveBeenCalledWith(event)
  })

  it('always calls dropOnNothing when the network is not a subgraph', () => {
    const rootGraph = new LGraph()
    const { adapter, dropOnIoNode, dropOnNothing } = buildAdapter(rootGraph)
    const event = dropEvent(0, 0)

    adapter.dropOnCanvas(event)

    expect(dropOnIoNode).not.toHaveBeenCalled()
    expect(dropOnNothing).toHaveBeenCalledTimes(1)
    expect(dropOnNothing).toHaveBeenCalledWith(event)
  })
})
