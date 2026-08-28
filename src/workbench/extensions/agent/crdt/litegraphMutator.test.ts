import { describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

import type { GraphMutation } from './graphMutations'
import { LitegraphMutator } from './litegraphMutator'
import type { LitegraphMutatorDeps } from './litegraphMutator'

/**
 * Minimal fakes for the slice of the litegraph API the mutator touches. Using
 * injected fakes (rather than only the browser E2E) keeps the mutator's glue
 * — id passthrough, widget lookup, remote-scope wrapping, missing-node guards —
 * under fast, deterministic unit coverage.
 */
class FakeNode {
  id: NodeId = toNodeId(-1)
  pos: [number, number] = [0, 0]
  readonly widgets: { name: string; value: unknown }[]
  readonly connectCalls: {
    originSlot: number
    target: FakeNode
    targetSlot: number
  }[] = []
  readonly disconnectedInputs: number[] = []

  constructor(
    readonly type: string,
    widgetNames: string[] = []
  ) {
    this.widgets = widgetNames.map((name) => ({ name, value: undefined }))
  }

  connect(originSlot: number, target: FakeNode, targetSlot: number): unknown {
    this.connectCalls.push({ originSlot, target, targetSlot })
    return {}
  }

  disconnectInput(targetSlot: number): boolean {
    this.disconnectedInputs.push(targetSlot)
    return true
  }
}

class FakeGraph {
  readonly nodes = new Map<NodeId, FakeNode>()
  dirtyCanvas: [boolean, boolean] | null = null

  add(node: FakeNode): void {
    this.nodes.set(node.id, node)
  }

  remove(node: FakeNode): void {
    this.nodes.delete(node.id)
  }

  getNodeById(id: NodeId): FakeNode | null {
    return this.nodes.get(id) ?? null
  }

  setDirtyCanvas(a: boolean, b: boolean): void {
    this.dirtyCanvas = [a, b]
  }
}

/** Widget name sets by node type, mirroring the fixed-schema invariant. */
const WIDGETS_BY_TYPE: Record<string, string[]> = {
  KSampler: ['seed', 'steps'],
  LoadVideo: ['fps']
}

function makeMutator(overrides: Partial<LitegraphMutatorDeps> = {}): {
  mutator: LitegraphMutator
  graph: FakeGraph
  created: FakeNode[]
} {
  const graph = new FakeGraph()
  const created: FakeNode[] = []
  const deps: LitegraphMutatorDeps = {
    getGraph: () => graph as unknown as LGraph,
    createNode: (type: string) => {
      const node = new FakeNode(type, WIDGETS_BY_TYPE[type] ?? [])
      created.push(node)
      return node as unknown as LGraphNode
    },
    ...overrides
  }
  return { mutator: new LitegraphMutator(deps), graph, created }
}

function batch(...mutations: GraphMutation[]) {
  return { source: 'agent-remote' as const, actor: 'test', mutations }
}

describe('LitegraphMutator', () => {
  it('adds a node with a coerced numeric id, position, and widget values', () => {
    const { mutator, graph, created } = makeMutator()
    mutator.applyBatch(
      batch({
        kind: 'add_node',
        node: {
          id: toNodeId('7'),
          type: 'KSampler',
          pos: [10, 20],
          widgets: { seed: 42 }
        }
      })
    )
    expect(created).toHaveLength(1)
    const node = graph.getNodeById(toNodeId('7'))
    expect(node).not.toBeNull()
    expect(node?.type).toBe('KSampler')
    expect(node?.pos).toEqual([10, 20])
    expect(node?.widgets.find((w) => w.name === 'seed')?.value).toBe(42)
    // Untouched widget stays at its default.
    expect(node?.widgets.find((w) => w.name === 'steps')?.value).toBeUndefined()
    expect(graph.dirtyCanvas).toEqual([true, true])
  })

  it('keeps a non-integer id as a string', () => {
    const { mutator, graph } = makeMutator()
    mutator.applyBatch(
      batch({
        kind: 'add_node',
        node: {
          id: toNodeId('abc'),
          type: 'LoadVideo',
          pos: [0, 0],
          widgets: {}
        }
      })
    )
    expect(graph.getNodeById(toNodeId('abc'))).not.toBeNull()
  })

  it('skips add when the node factory returns null', () => {
    const { mutator, graph } = makeMutator({ createNode: () => null })
    expect(() =>
      mutator.applyBatch(
        batch({
          kind: 'add_node',
          node: { id: toNodeId('1'), type: 'Missing', pos: [0, 0], widgets: {} }
        })
      )
    ).not.toThrow()
    expect(graph.nodes.size).toBe(0)
  })

  it('removes an existing node and ignores a missing one', () => {
    const { mutator, graph } = makeMutator()
    const node = new FakeNode('KSampler')
    node.id = toNodeId('3')
    graph.add(node)
    mutator.applyBatch(
      batch(
        { kind: 'remove_node', id: toNodeId('3') },
        { kind: 'remove_node', id: toNodeId('999') }
      )
    )
    expect(graph.getNodeById(toNodeId('3'))).toBeNull()
  })

  it('moves an existing node', () => {
    const { mutator, graph } = makeMutator()
    const node = new FakeNode('KSampler')
    node.id = toNodeId('5')
    graph.add(node)
    mutator.applyBatch(
      batch({ kind: 'move_node', id: toNodeId('5'), pos: [100, 200] })
    )
    expect(node.pos).toEqual([100, 200])
  })

  it('sets a matching widget and ignores an unknown widget name', () => {
    const { mutator, graph } = makeMutator()
    const node = new FakeNode('KSampler', ['seed', 'steps'])
    node.id = toNodeId('2')
    graph.add(node)
    mutator.applyBatch(
      batch(
        { kind: 'set_widget', id: toNodeId('2'), name: 'seed', value: 123 },
        { kind: 'set_widget', id: toNodeId('2'), name: 'nope', value: 9 }
      )
    )
    expect(node.widgets.find((w) => w.name === 'seed')?.value).toBe(123)
    expect(node.widgets.some((w) => w.name === 'nope')).toBe(false)
  })

  it('clears a widget back to its node-type default without touching the graph', () => {
    const { mutator, graph, created } = makeMutator()
    mutator.applyBatch(
      batch({
        kind: 'add_node',
        node: {
          id: toNodeId('3'),
          type: 'KSampler',
          pos: [0, 0],
          widgets: { seed: 42 }
        }
      })
    )
    const node = graph.getNodeById(toNodeId('3'))!
    expect(node.widgets.find((w) => w.name === 'seed')?.value).toBe(42)
    const nodesBefore = graph.nodes.size

    mutator.applyBatch(
      batch({ kind: 'clear_widget', id: toNodeId('3'), name: 'seed' })
    )

    // The default is read off a transient node of the same type; the
    // transient is never added to the graph.
    expect(node.widgets.find((w) => w.name === 'seed')?.value).toBeUndefined()
    expect(graph.nodes.size).toBe(nodesBefore)
    expect(created).toHaveLength(2)
  })

  it('ignores a clear for an unknown widget or node', () => {
    const { mutator, graph, created } = makeMutator()
    mutator.applyBatch(
      batch({
        kind: 'add_node',
        node: { id: toNodeId('3'), type: 'KSampler', pos: [0, 0], widgets: {} }
      })
    )

    mutator.applyBatch(
      batch(
        { kind: 'clear_widget', id: toNodeId('3'), name: 'nope' },
        { kind: 'clear_widget', id: toNodeId('9'), name: 'seed' }
      )
    )

    expect(graph.nodes.size).toBe(1)
    expect(created).toHaveLength(1)
  })

  it('connects and disconnects between resolved nodes', () => {
    const { mutator, graph } = makeMutator()
    const origin = new FakeNode('LoadVideo')
    origin.id = toNodeId('1')
    const target = new FakeNode('KSampler')
    target.id = toNodeId('2')
    graph.add(origin)
    graph.add(target)
    mutator.applyBatch(
      batch(
        {
          kind: 'connect',
          link: {
            id: 'l1',
            originId: toNodeId('1'),
            originSlot: 0,
            targetId: toNodeId('2'),
            targetSlot: 1
          }
        },
        { kind: 'disconnect', id: 'l1', targetId: toNodeId('2'), targetSlot: 1 }
      )
    )
    expect(origin.connectCalls).toEqual([
      { originSlot: 0, target, targetSlot: 1 }
    ])
    expect(target.disconnectedInputs).toEqual([1])
  })

  it('does nothing when there is no active graph', () => {
    const scope = vi.fn()
    const mutator = new LitegraphMutator({
      getGraph: () => null,
      createNode: () => null,
      runRemoteScope: scope
    })
    expect(() =>
      mutator.applyBatch(
        batch({
          kind: 'add_node',
          node: { id: toNodeId('1'), type: 'X', pos: [0, 0], widgets: {} }
        })
      )
    ).not.toThrow()
    expect(scope).not.toHaveBeenCalled()
  })

  it('applies every mutation inside the injected remote scope', () => {
    const events: string[] = []
    const { mutator, graph } = makeMutator({
      runRemoteScope: (apply) => {
        events.push('enter')
        apply()
        events.push('exit')
      }
    })
    mutator.applyBatch(
      batch({
        kind: 'add_node',
        node: { id: toNodeId('1'), type: 'LoadVideo', pos: [0, 0], widgets: {} }
      })
    )
    // The graph mutation and the dirty-canvas flush both land between the
    // scope's enter and exit — proving remote edits are tagged, never echoed.
    expect(events).toEqual(['enter', 'exit'])
    expect(graph.getNodeById(toNodeId('1'))).not.toBeNull()
    expect(graph.dirtyCanvas).toEqual([true, true])
  })
})
