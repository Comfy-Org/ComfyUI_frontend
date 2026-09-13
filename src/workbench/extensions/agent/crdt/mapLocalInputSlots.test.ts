import { mint } from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import type { GraphOperation } from './graphOperations'
import { mapLocalInputSlots } from './mapLocalInputSlots'

type ConnectOperation = Extract<GraphOperation, { op: 'connect' }>

interface Fixture {
  graph: LGraph
  source: LGraphNode
  target: LGraphNode
  doc: Y.Doc
}

let fixture: Fixture | undefined

function buildFixture(): Fixture {
  const graph = new LGraph()
  const source = new LGraphNode('Source', 'Source')
  source.addOutput('value', 'INT')
  graph.add(source)
  const target = new LGraphNode('Target', 'Target')
  target.addInput('image_0', 'IMAGE')
  target.addInput('width', 'INT')
  target.addInput('height', 'INT')
  graph.add(target)
  const doc = mint(
    {
      nodes: [source, target].map((node) => ({
        ...node.serialize(),
        flags: { ...node.flags }
      })),
      links: []
    },
    { types: {} }
  )
  fixture = { graph, source, target, doc }
  return fixture
}

type IndexedConnectOperation = Extract<ConnectOperation, { to_slot: number }>

function connectTo(
  source: LGraphNode,
  target: LGraphNode,
  toSlot: number
): IndexedConnectOperation {
  return {
    op: 'connect',
    link_id: 1,
    from_node: source.id,
    from_slot: 0,
    to_node: target.id,
    to_slot: toSlot,
    link_type: 'INT'
  }
}

afterEach(() => {
  fixture?.doc.destroy()
  fixture = undefined
})

describe('mapLocalInputSlots', () => {
  it('sends an existing input by its document index after local inputs move', () => {
    const { graph, source, target, doc } = buildFixture()
    target.addInput('image_1', 'IMAGE')
    target.inputs = [target.inputs[3], ...target.inputs.slice(0, 3)]
    expect(target.findInputSlot('width')).toBe(2)

    const mapped = mapLocalInputSlots(doc, graph, [
      connectTo(source, target, target.findInputSlot('width'))
    ])

    expect(mapped).toEqual([
      expect.objectContaining({
        op: 'connect',
        to_slot: 1,
        from_slot: 0,
        grow: null
      })
    ])
  })

  it('reports and drops a connection to an input missing from an existing document node', () => {
    const { graph, source, target, doc } = buildFixture()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    target.addInput('new_width', 'INT')

    const mapped = mapLocalInputSlots(doc, graph, [
      connectTo(source, target, target.findInputSlot('new_width'))
    ])

    expect(mapped).toEqual([])
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        'connect input is absent from the bound document'
      ),
      1
    )
  })

  it('reports and drops a connection when the runtime target node is missing', () => {
    const { graph, source, target, doc } = buildFixture()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    graph.remove(target)

    const mapped = mapLocalInputSlots(doc, graph, [
      connectTo(source, target, 1)
    ])

    expect(mapped).toEqual([])
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        'connect input is absent from the bound document'
      ),
      1
    )
  })

  it('preserves a new local node connection before its add_node is echoed', () => {
    const { graph, source, doc } = buildFixture()
    const target = new LGraphNode('PendingTarget', 'PendingTarget')
    target.addInput('width', 'INT')
    graph.add(target)
    const add: GraphOperation = {
      op: 'add_node',
      node_id: target.id,
      class_type: target.type,
      pos: [...target.pos],
      node: { ...target.serialize(), flags: { ...target.flags } }
    }
    const connect = connectTo(source, target, 0)

    expect(mapLocalInputSlots(doc, graph, [add, connect])).toEqual([
      add,
      connect
    ])
  })

  it('passes through non-connect operations and connects that already carry grow', () => {
    const { graph, source, target, doc } = buildFixture()
    const remove: GraphOperation = {
      op: 'delete_node',
      node_id: target.id,
      removed_links: []
    }
    const grown: GraphOperation = {
      op: 'connect',
      link_id: 1,
      from_node: source.id,
      from_slot: 0,
      to_node: target.id,
      to_slot: null,
      link_type: 'INT',
      grow: { name: 'image_2', type: 'IMAGE' }
    }

    expect(mapLocalInputSlots(doc, graph, [remove, grown])).toEqual([
      remove,
      grown
    ])
  })

  it('drops a connect to a missing slot when grow is explicitly null', () => {
    const { graph, source, target, doc } = buildFixture()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unmapped: ConnectOperation = {
      ...connectTo(source, target, 5),
      grow: null
    }

    expect(mapLocalInputSlots(doc, graph, [unmapped])).toEqual([])
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})
