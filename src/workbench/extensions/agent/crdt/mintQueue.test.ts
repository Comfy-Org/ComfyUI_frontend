import { describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createMintQueue, orderMintedOperations } from './mintQueue'

function addNode(id: number): GraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'TestNode',
    pos: [0, 0],
    node: { id, type: 'TestNode' }
  }
}

function deleteNode(id: number): GraphOperation {
  return { op: 'delete_node', node_id: id, removed_links: [] }
}

function connect(linkId: number, from: number, to: number): GraphOperation {
  return {
    op: 'connect',
    link_id: linkId,
    from_node: from,
    from_slot: 0,
    to_node: to,
    to_slot: 0,
    link_type: 'IMAGE'
  }
}

function setWidget(nodeId: number, value: unknown): GraphOperation {
  return { op: 'set_widget', node_id: nodeId, widget: 'seed', value, old: 0 }
}

async function afterDrain(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('orderMintedOperations', () => {
  it('lands structural ops before the connects and widget writes that need them', () => {
    // The sync feeds mint first in a same-task createNode + registerLink +
    // setValue; the layout store's add_node arrives a microtask later.
    expect(
      orderMintedOperations([
        connect(41, 1, 2),
        setWidget(2, 'x'),
        addNode(1),
        addNode(2)
      ])
    ).toEqual([addNode(1), addNode(2), connect(41, 1, 2), setWidget(2, 'x')])
  })

  it('keeps layout-store order within the structural class', () => {
    expect(
      orderMintedOperations([deleteNode(1), addNode(1), addNode(2)])
    ).toEqual([deleteNode(1), addNode(1), addNode(2)])
  })

  it('keeps mint order within the dependent class', () => {
    expect(
      orderMintedOperations([
        setWidget(2, 'a'),
        connect(41, 1, 2),
        setWidget(2, 'b')
      ])
    ).toEqual([setWidget(2, 'a'), connect(41, 1, 2), setWidget(2, 'b')])
  })

  it('drops a widget write or connect orphaned by a same-drain delete', () => {
    expect(
      orderMintedOperations([
        setWidget(2, 'x'),
        setWidget(3, 'kept'),
        connect(41, 1, 2),
        connect(42, 1, 3),
        deleteNode(2)
      ])
    ).toEqual([deleteNode(2), setWidget(3, 'kept'), connect(42, 1, 3)])
  })

  it("drops writes to a clear's removed nodes but not to nodes added after it", () => {
    expect(
      orderMintedOperations([
        setWidget(5, 'pre-clear'),
        { op: 'clear', removed_nodes: [5, 6] },
        addNode(7),
        setWidget(7, 'post-clear'),
        connect(41, 6, 7)
      ])
    ).toEqual([
      { op: 'clear', removed_nodes: [5, 6] },
      addNode(7),
      setWidget(7, 'post-clear')
    ])
  })

  it('keeps a write to a node deleted and re-added in the same drain', () => {
    expect(
      orderMintedOperations([deleteNode(1), addNode(1), setWidget(1, 'x')])
    ).toEqual([deleteNode(1), addNode(1), setWidget(1, 'x')])
  })

  it('never prunes a subgraph-interior widget write', () => {
    const interior: GraphOperation = {
      op: 'set_widget',
      node_id: 2,
      widget: 'seed',
      value: 1,
      old: 0,
      path: ['2'],
      inner_widget: 'seed'
    }
    expect(orderMintedOperations([interior, deleteNode(2)])).toEqual([
      deleteNode(2),
      interior
    ])
  })
})

describe('createMintQueue', () => {
  it('delivers one ordered batch per task after a double microtask', async () => {
    const delivered: GraphOperation[][] = []
    const queue = createMintQueue((operations) => delivered.push(operations))

    queue.enqueue([connect(41, 1, 2)])
    queueMicrotask(() => queue.enqueue([addNode(1), addNode(2)]))
    expect(delivered).toEqual([])
    await Promise.resolve()
    expect(delivered).toEqual([])
    await Promise.resolve()

    expect(delivered).toEqual([[addNode(1), addNode(2), connect(41, 1, 2)]])
  })

  it('prunes the write a same-drain delete orphaned', async () => {
    const delivered: GraphOperation[][] = []
    const queue = createMintQueue((operations) => delivered.push(operations))

    queue.enqueue([setWidget(2, 'x')])
    queue.enqueue([deleteNode(2)])
    await afterDrain()

    expect(delivered).toEqual([[deleteNode(2)]])
  })

  it('flush delivers synchronously and the scheduled drain then finds nothing', async () => {
    const delivered: GraphOperation[][] = []
    const queue = createMintQueue((operations) => delivered.push(operations))

    queue.enqueue([addNode(1)])
    queue.flush()
    expect(delivered).toEqual([[addNode(1)]])
    await afterDrain()

    expect(delivered).toHaveLength(1)
  })

  it('separate tasks drain separately, in task order', async () => {
    const delivered: GraphOperation[][] = []
    const queue = createMintQueue((operations) => delivered.push(operations))

    queue.enqueue([addNode(1)])
    await afterDrain()
    queue.enqueue([setWidget(1, 'x')])
    await afterDrain()

    expect(delivered).toEqual([[addNode(1)], [setWidget(1, 'x')]])
  })
})
