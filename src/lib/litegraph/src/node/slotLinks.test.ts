import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

import { createTestSubgraph } from '../subgraph/__fixtures__/subgraphHelpers'
import {
  inputHasLink,
  inputLink,
  inputLinkId,
  outputHasLinks,
  outputLinkIds,
  outputLinks
} from './slotLinks'

function createConnectedGraph(targetCount: number) {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const targets = Array.from({ length: targetCount }, (_, i) => {
    const target = new LGraphNode(`Target${i}`)
    target.addInput('in', 'INT')
    graph.add(target)
    source.connect(0, target, 0)
    return target
  })

  return { graph, source, targets }
}

describe('slotLinks', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('reports presence, ids, and resolved links for an output slot', () => {
    const { graph, source } = createConnectedGraph(2)

    expect(outputHasLinks(graph, source.id, 0)).toBe(true)
    const ids = outputLinkIds(graph, source.id, 0)
    expect(ids).toHaveLength(2)
    expect([...ids]).toEqual([...ids].sort((a, b) => a - b))
    expect(outputLinks(graph, source.id, 0).map((l) => l.id)).toEqual(ids)
  })

  it('returns nothing for an unconnected slot', () => {
    const { graph, source } = createConnectedGraph(0)

    expect(outputHasLinks(graph, source.id, 0)).toBe(false)
    expect(outputLinkIds(graph, source.id, 0)).toEqual([])
    expect(outputLinks(graph, source.id, 0)).toEqual([])
  })

  it('never includes floating links', () => {
    const { graph, source, targets } = createConnectedGraph(1)
    const link = inputLink(graph, targets[0].id, 0)!
    const reroute = graph.createReroute([0, 0], link)!
    graph.remove(targets[0])

    expect(graph.floatingLinks.size).toBe(1)
    expect(reroute.floatingLinkIds.size).toBe(1)
    expect(outputHasLinks(graph, source.id, 0)).toBe(false)
    expect(outputLinks(graph, source.id, 0)).toEqual([])
  })

  it('reports presence, id, and the resolved link for an input slot', () => {
    const { graph, targets } = createConnectedGraph(1)
    const target = targets[0]

    expect(inputHasLink(graph, target.id, 0)).toBe(true)
    const id = inputLinkId(graph, target.id, 0)
    const link = inputLink(graph, target.id, 0)
    expect(link?.id).toBe(id)
    expect(link?.target_id).toBe(target.id)
    expect(link?.target_slot).toBe(0)
  })

  it('returns nothing for an unconnected input slot', () => {
    const { graph, targets } = createConnectedGraph(1)
    const target = targets[0]
    target.disconnectInput(0)

    expect(inputHasLink(graph, target.id, 0)).toBe(false)
    expect(inputLinkId(graph, target.id, 0)).toBeUndefined()
    expect(inputLink(graph, target.id, 0)).toBeUndefined()
  })

  it('never reports a floating link on the input side', () => {
    const { graph, source, targets } = createConnectedGraph(1)
    const link = inputLink(graph, targets[0].id, 0)!
    graph.createReroute([0, 0], link)

    graph.remove(source)

    expect(graph.floatingLinks.size).toBe(1)
    expect(inputHasLink(graph, targets[0].id, 0)).toBe(false)
    expect(inputLink(graph, targets[0].id, 0)).toBeUndefined()
  })

  it('resolves links inside a subgraph', () => {
    const subgraph = createTestSubgraph({ nodeCount: 2 })
    const [first, second] = subgraph.nodes
    const innerLink = first.connect(0, second, 0)!

    expect(inputHasLink(subgraph, second.id, 0)).toBe(true)
    expect(inputLinkId(subgraph, second.id, 0)).toBe(innerLink.id)
    expect(inputLink(subgraph, second.id, 0)).toBe(innerLink)
  })

  it('reads empty during the INPUT callback of a disconnect', () => {
    const { graph, targets } = createConnectedGraph(1)
    const target = targets[0]
    const seen: boolean[] = []
    target.onConnectionsChange = vi.fn(
      (type: NodeSlotType, _slot: number, connected: boolean) => {
        if (type === NodeSlotType.INPUT && !connected) {
          seen.push(inputHasLink(graph, target.id, 0))
        }
      }
    )

    target.disconnectInput(0)

    expect(seen).toEqual([false])
  })

  it('reads empty during the final OUTPUT callback of a disconnect-all', () => {
    const { graph, source } = createConnectedGraph(2)
    const seen: boolean[] = []
    source.onConnectionsChange = vi.fn(
      (type: NodeSlotType, _slot: number, connected: boolean) => {
        if (type === NodeSlotType.OUTPUT && !connected) {
          seen.push(outputHasLinks(graph, source.id, 0))
        }
      }
    )

    source.disconnectOutput(0)

    expect(seen).toEqual([true, false])
  })
})
