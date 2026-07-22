import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

import { outputHasLinks, outputLinkIds, outputLinks } from './slotLinks'

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
    const link = graph.getLink(targets[0].inputs[0].link!)!
    const reroute = graph.createReroute([0, 0], link)!
    graph.remove(targets[0])

    expect(graph.floatingLinks.size).toBe(1)
    expect(reroute.floatingLinkIds.size).toBe(1)
    expect(outputHasLinks(graph, source.id, 0)).toBe(false)
    expect(outputLinks(graph, source.id, 0)).toEqual([])
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
