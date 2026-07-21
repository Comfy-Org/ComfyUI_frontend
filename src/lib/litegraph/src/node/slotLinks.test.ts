import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

import { createTestSubgraph } from '../subgraph/__fixtures__/subgraphHelpers'
import {
  captureInputLayout,
  inputHasLink,
  inputLink,
  inputLinkId,
  outputHasLinks,
  outputLinkIds,
  outputLinks,
  replaceNodeInputs
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
  it('atomically reorders connected inputs', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'INT')
    graph.add(source)
    const target = new LGraphNode('Target')
    target.addInput('first', 'INT')
    target.addInput('second', 'INT')
    graph.add(target)
    const first = source.connect(0, target, 0)!
    const second = source.connect(0, target, 1)!
    const previous = captureInputLayout(target)

    replaceNodeInputs(target, previous, target.inputs.toReversed())

    expect(target.inputs.map(({ name }) => name)).toEqual(['second', 'first'])
    expect(target.getInputLink(0)).toBe(second)
    expect(target.getInputLink(1)).toBe(first)
  })

  it('disconnects a removed linked input before replacing the layout', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'INT')
    graph.add(source)
    const target = new LGraphNode('Target')
    target.addInput('keep', 'INT')
    target.addInput('remove', 'INT')
    graph.add(target)
    const removedLink = source.connect(0, target, 1)!
    const removedInput = target.inputs[1]
    const disconnected = vi.fn()
    target.onConnectionsChange = (type, slot, connected, _link, input) => {
      if (type === NodeSlotType.INPUT && !connected) {
        disconnected(slot, input)
      }
    }

    replaceNodeInputs(target, captureInputLayout(target), [target.inputs[0]])

    expect(disconnected).toHaveBeenCalledOnce()
    expect(disconnected).toHaveBeenCalledWith(1, removedInput)
    expect(graph.getLink(removedLink.id)).toBeUndefined()
    expect(target.inputs).toHaveLength(1)
  })
  it('rejects a stale layout snapshot before changing topology', () => {
    const { graph, targets } = createConnectedGraph(1)
    const target = targets[0]
    target.addInput('extra', 'INT')
    const previous = captureInputLayout(target)
    const link = target.getInputLink(0)
    target.inputs.reverse()

    expect(() => replaceNodeInputs(target, previous, previous.inputs)).toThrow(
      'changed after it was captured'
    )
    expect(graph.getLink(link!.id)).toBe(link)
    expect(target.isInputConnected(0)).toBe(true)
  })

  it('preflights assignments before disconnecting removed links', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'INT')
    graph.add(source)
    const target = new LGraphNode('Target')
    target.addInput('keep', 'INT')
    target.addInput('remove', 'INT')
    graph.add(target)
    const kept = source.connect(0, target, 0)!
    const removed = source.connect(0, target, 1)!
    const staleTarget = new LGraphNode('Stale')
    staleTarget.addInput('in', 'INT')
    graph.add(staleTarget)
    const stale = source.connect(0, staleTarget, 0)!
    staleTarget.disconnectInput(0)
    const previous = captureInputLayout(target)
    const assignments = new Map(previous.links)
    assignments.set(target.inputs[0], stale)
    const onConnectionsChange = vi.fn()
    target.onConnectionsChange = onConnectionsChange

    expect(() =>
      replaceNodeInputs(target, previous, [target.inputs[0]], assignments)
    ).toThrow('does not own its current placement')

    expect(target.getInputLink(0)).toBe(kept)
    expect(target.getInputLink(1)).toBe(removed)
    expect(onConnectionsChange).not.toHaveBeenCalled()
  })
})
