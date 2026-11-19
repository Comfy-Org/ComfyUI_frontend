import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { NodeChangeEvent } from '@/platform/nodeApi/v4/types'

import { apiOnTestCanvas } from './__tests__/testCanvasSource'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

function documentOnScreen() {
  const root = new LGraph()
  const outer = new LGraphNode('Outer')
  root.add(outer)
  const subgraph = createTestSubgraph({ rootGraph: root })
  root.subgraphs.set(subgraph.id, subgraph)
  root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))
  const inner = new LGraphNode('Inner')
  subgraph.add(inner)
  return { root, outer, subgraph, inner, ...apiOnTestCanvas(root) }
}

function heard(events: NodeChangeEvent[]) {
  return events.map(({ node, graphId, property, to }) => ({
    id: node.id,
    graphId,
    property,
    to
  }))
}

describe('onNodeChanged', () => {
  it('reports a title, mode or color change with the value its read returns', () => {
    const { root, outer, comfy } = documentOnScreen()
    const events: NodeChangeEvent[] = []
    comfy.onNodeChanged((event) => events.push(event))

    outer.title = 'Renamed'
    outer.mode = LGraphEventMode.BYPASS
    outer.color = '#123456'
    outer.bgcolor = '#654321'

    expect(heard(events)).toEqual([
      { id: outer.id, graphId: root.id, property: 'title', to: 'Renamed' },
      { id: outer.id, graphId: root.id, property: 'mode', to: 'bypass' },
      { id: outer.id, graphId: root.id, property: 'color', to: '#123456' },
      { id: outer.id, graphId: root.id, property: 'bgColor', to: '#654321' }
    ])
    expect(events[0].node).toBe(comfy.graph.node(String(outer.id)))
  })

  it('hears an edit a handle makes', () => {
    const { outer, comfy } = documentOnScreen()
    const events: NodeChangeEvent[] = []
    comfy.onNodeChanged((event) => events.push(event))
    const handle = comfy.graph.node(String(outer.id))
    assert(handle)

    expect(handle.setTitle('Edited')).toBe(true)

    expect(heard(events)).toEqual([
      expect.objectContaining({ property: 'title', to: 'Edited' })
    ])
  })

  it('passes a frozen event', () => {
    const { outer, comfy } = documentOnScreen()
    const events: NodeChangeEvent[] = []
    comfy.onNodeChanged((event) => events.push(event))

    outer.title = 'Renamed'

    expect(Object.isFrozen(events[0])).toBe(true)
  })

  it('leaves out a property the API has no read for', () => {
    const { outer, comfy } = documentOnScreen()
    const listener = vi.fn()
    comfy.onNodeChanged(listener)

    outer.boxcolor = '#ff0000'

    expect(listener).not.toHaveBeenCalled()

    outer.title = 'Renamed'

    expect(listener).toHaveBeenCalledOnce()
  })

  it('hears only the graph on screen, and follows the user into a subgraph', () => {
    const { outer, subgraph, inner, comfy, show } = documentOnScreen()
    const events: NodeChangeEvent[] = []
    comfy.onNodeChanged((event) => events.push(event))

    inner.title = 'Not on screen'
    show(subgraph)
    outer.title = 'Left behind'
    inner.title = 'On screen now'

    expect(heard(events)).toEqual([
      {
        id: inner.id,
        graphId: subgraph.id,
        property: 'title',
        to: 'On screen now'
      }
    ])
  })

  it('hears the root graph and every subgraph when asked to', () => {
    const { root, outer, subgraph, inner, comfy, show } = documentOnScreen()
    const events: NodeChangeEvent[] = []
    comfy.onNodeChanged((event) => events.push(event), {
      scope: 'root-and-subgraphs'
    })

    inner.title = 'Inner renamed'
    show(subgraph)
    outer.title = 'Outer renamed'

    expect(heard(events)).toEqual([
      {
        id: inner.id,
        graphId: subgraph.id,
        property: 'title',
        to: 'Inner renamed'
      },
      { id: outer.id, graphId: root.id, property: 'title', to: 'Outer renamed' }
    ])
  })

  it('hears a subgraph created after it subscribed', () => {
    const { root, comfy } = documentOnScreen()
    const listener = vi.fn()
    comfy.onNodeChanged(listener, { scope: 'root-and-subgraphs' })

    const [created] = root.createSubgraphs([
      createTestSubgraph({ rootGraph: new LGraph() }).asSerialisable()
    ])
    const node = new LGraphNode('In the new subgraph')
    created.add(node)
    node.title = 'Renamed'

    expect(listener).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ graphId: created.id, property: 'title' })
    )
  })

  it('keeps listening to a graph that stays in scope as the user moves', () => {
    const { root, subgraph, comfy, show } = documentOnScreen()
    const removeListener = vi.spyOn(root.events, 'removeEventListener')
    comfy.onNodeChanged(vi.fn(), { scope: 'root-and-subgraphs' })

    show(subgraph)

    expect(removeListener).not.toHaveBeenCalled()
  })

  it('stops following the set of subgraphs once its last listener leaves', () => {
    const { root, comfy } = documentOnScreen()
    comfy.onNodeChanged(vi.fn(), { scope: 'root-and-subgraphs' })()

    const [created] = root.createSubgraphs([
      createTestSubgraph({ rootGraph: new LGraph() }).asSerialisable()
    ])
    const listener = vi.fn()
    comfy.onNodeChanged(listener, { scope: 'root-and-subgraphs' })
    const node = new LGraphNode('In the new subgraph')
    created.add(node)
    node.title = 'Renamed'

    expect(listener).toHaveBeenCalledOnce()
  })

  it('lets go of a subgraph deleted with its last placement', () => {
    const { root, subgraph, comfy } = documentOnScreen()
    const removeListener = vi.spyOn(subgraph.events, 'removeEventListener')
    comfy.onNodeChanged(vi.fn(), { scope: 'root-and-subgraphs' })
    const placed = root.nodes.find((node) => node.isSubgraphNode())
    assert(placed)

    root.remove(placed)

    expect(removeListener).toHaveBeenCalledWith(
      'node:property:changed',
      expect.any(Function)
    )
  })

  it('names a node of the document loaded since with a new handle', () => {
    const { outer, comfy, host } = documentOnScreen()
    const kept = comfy.graph.node(String(outer.id))
    const events: NodeChangeEvent[] = []
    comfy.onNodeChanged((event) => events.push(event))

    host.beginDocument()
    outer.title = 'In the next document'

    expect(kept?.isDeleted).toBe(true)
    expect(events[0].node).not.toBe(kept)
    expect(events[0].node.isDeleted).toBe(false)
  })

  it.for([
    ['a non-object', 'visible'],
    ['null', null],
    ['an unknown scope', { scope: 'document' }],
    ['a scope that is not a string', { scope: 1 }],
    ['a field queryNodes would refuse', { scope: 'visible', typ: 'x' }]
  ] as const)('refuses %s as options before listening', ([, options]) => {
    const { outer, comfy } = documentOnScreen()
    const listener = vi.fn()

    expectRefusal(
      () => Reflect.apply(comfy.onNodeChanged, comfy, [listener, options]),
      'onNodeChanged'
    )
    outer.title = 'Renamed'

    expect(listener).not.toHaveBeenCalled()
  })

  it('refuses a listener that is not a function', () => {
    const { comfy } = documentOnScreen()

    expect(() =>
      Reflect.apply(comfy.onNodeChanged, comfy, ['listener'])
    ).toThrow("onNodeChanged needs a function to call, not 'listener'.")
  })

  it('reports a listener that throws and still calls the others', () => {
    const { outer, comfy } = documentOnScreen()
    const after = vi.fn()
    comfy.onNodeChanged(() => {
      throw new Error('pack failed')
    })
    comfy.onNodeChanged(after)

    outer.title = 'Renamed'

    expect(after).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('stops listening to the graph when its last listener leaves', () => {
    const { root, outer, comfy } = documentOnScreen()
    const removeListener = vi.spyOn(root.events, 'removeEventListener')
    const first = vi.fn()
    const stopFirst = comfy.onNodeChanged(first)
    const stopSecond = comfy.onNodeChanged(vi.fn())

    stopFirst()
    stopFirst()
    outer.title = 'Still heard by the second'

    expect(first).not.toHaveBeenCalled()
    expect(removeListener).not.toHaveBeenCalled()

    stopSecond()

    expect(removeListener).toHaveBeenCalledWith(
      'node:property:changed',
      expect.any(Function)
    )
  })

  it('hears nothing, and still returns a disposer, before the renderer supplies a canvas', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })
    const listener = vi.fn()

    const stop = comfy.onNodeChanged(listener, { scope: 'root-and-subgraphs' })
    stop()

    expect(listener).not.toHaveBeenCalled()
  })
})
