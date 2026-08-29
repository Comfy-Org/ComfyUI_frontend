import { describe, expect, it } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

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
  readonly _size: [number, number] = [100, 80]
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
  readonly rootGraph = { id: createUuidv4() }
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
  positions: Map<NodeId, [number, number]>
} {
  const graph = new FakeGraph()
  const created: FakeNode[] = []
  const positions = new Map<NodeId, [number, number]>()
  const deps: LitegraphMutatorDeps = {
    getGraph: () => graph as unknown as LGraph,
    createNode: (type: string) => {
      const node = new FakeNode(type, WIDGETS_BY_TYPE[type] ?? [])
      created.push(node)
      return node as unknown as LGraphNode
    },
    layout: {
      prepareNode: (_graph, node, position) => {
        positions.set(node.id, [position[0], position[1]])
      },
      moveNode: (_graph, node, position) => {
        positions.set(node.id, [position[0], position[1]])
      },
      detachNode: (node) => {
        positions.delete(node.id)
      }
    },
    ...overrides
  }
  return { mutator: new LitegraphMutator(deps), graph, created, positions }
}

function batch(...mutations: GraphMutation[]) {
  return { source: 'agent-remote' as const, actor: 'test', mutations }
}

describe('LitegraphMutator', () => {
  it('adds a node with a coerced numeric id, position, and widget values', () => {
    const { mutator, graph, created, positions } = makeMutator()
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
    expect(positions.get(toNodeId('7'))).toEqual([10, 20])
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

  it('delegates move to the source-bound layout seam', () => {
    const { mutator, graph, positions } = makeMutator()
    const node = new FakeNode('KSampler')
    node.id = toNodeId('5')
    graph.add(node)
    mutator.applyBatch(
      batch({ kind: 'move_node', id: toNodeId('5'), pos: [100, 200] })
    )
    expect(positions.get(node.id)).toEqual([100, 200])
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
    const mutator = new LitegraphMutator({
      getGraph: () => null,
      createNode: () => null,
      layout: {
        prepareNode: () => undefined,
        moveNode: () => undefined,
        detachNode: () => undefined
      }
    })
    expect(() =>
      mutator.applyBatch(
        batch({
          kind: 'add_node',
          node: { id: toNodeId('1'), type: 'X', pos: [0, 0], widgets: {} }
        })
      )
    ).not.toThrow()
  })
})
