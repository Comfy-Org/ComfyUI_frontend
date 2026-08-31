import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { toNodeId } from '@/types/nodeId'

import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import { installUnplacedLinkBridge } from './unplacedLinkBridge'

const offer = vi.hoisted(() => vi.fn())
vi.mock('@/platform/nodeApi/defsRegistry', () => ({
  offerUnplacedLink: offer
}))

describe('offering a link the connector could not place', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let stop: () => void

  function node(id: number, type: string) {
    const made = new LGraphNode(type, type)
    graph.add(made)
    made.id = toNodeId(id)
    return made
  }

  function dropOnBody(
    target: LGraphNode,
    origin: LGraphNode,
    modifier = false
  ) {
    const link = {
      node: origin,
      fromSlot: { type: 'CONTEXT' },
      fromSlotIndex: 0
    }
    return canvas.linkConnector.events.dispatch('link-unplaced', {
      node: target,
      link: link as never,
      side: 'input',
      event: { ctrlKey: modifier, metaKey: false } as CanvasPointerEvent
    })
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    offer.mockReset().mockReturnValue(false)
    graph = new LGraph()
    const element = document.createElement('canvas')
    document.body.appendChild(element)
    element.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    canvas = new LGraphCanvas(element, graph, {
      skip_events: true,
      skip_render: true
    })
    stop = installUnplacedLinkBridge(canvas)
  })

  it('asks the node the user aimed at first, then the drag origin', () => {
    // The node that knows how to place the link is the drop target in one
    // direction and the origin in the other, so both are asked; the target
    // goes first because that is where the user let go.
    const target = node(1, 'Sampler')
    const origin = node(2, 'Bundle')

    dropOnBody(target, origin)

    expect(
      offer.mock.calls.map(([, type, event]) => [type, event.side])
    ).toEqual([
      ['Sampler', 'input'],
      ['Bundle', 'output']
    ])
  })

  it('stops once one end claims the drop', () => {
    offer.mockReturnValueOnce(true)
    const target = node(1, 'Bundle')

    const notCancelled = dropOnBody(target, node(2, 'Sampler'))

    expect(offer).toHaveBeenCalledTimes(1)
    expect(notCancelled).toBe(false)
  })

  it('leaves the drop unplaced when neither end wants it', () => {
    expect(dropOnBody(node(1, 'A'), node(2, 'B'))).toBe(true)
  })

  it('reports the overwrite modifier, so packs stop tracking keys themselves', () => {
    dropOnBody(node(1, 'A'), node(2, 'B'), true)

    expect(offer.mock.calls[0][2]).toMatchObject({ replaceExisting: true })
  })

  it('names each end to the other', () => {
    dropOnBody(node(1, 'Sampler'), node(2, 'Bundle'))

    expect(offer.mock.calls[0][2]).toMatchObject({ peerNodeId: '2' })
    expect(offer.mock.calls[1][2]).toMatchObject({ peerNodeId: '1' })
  })

  it('stops offering once removed', () => {
    stop()

    dropOnBody(node(1, 'A'), node(2, 'B'))

    expect(offer).not.toHaveBeenCalled()
  })
})
