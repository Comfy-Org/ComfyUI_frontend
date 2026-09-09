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
  title: string
  has_errors: boolean | undefined
  properties: Record<string, unknown> = {}
  readonly widgets: { name: string; value: unknown; serialize?: boolean }[]
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
    this.title = type
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

  it('reuses an existing node and maps opaque widget indexes on replay', () => {
    const { mutator, graph, created } = makeMutator()
    const restored = new FakeNode('MarkdownNote', ['text'])
    restored.id = toNodeId('15')
    restored.title = 'Enable multi-image input'
    restored.has_errors = false
    restored.properties = { preserved: true }
    restored.widgets[0].value = 'stale text'
    graph.add(restored)

    mutator.applyBatch(
      batch({
        kind: 'add_node',
        node: {
          id: toNodeId('15'),
          type: 'MarkdownNote',
          pos: [30, 40],
          widgets: { '0': 'Preserve this exact text after tab switching.' }
        }
      })
    )

    expect(created).toHaveLength(0)
    expect(graph.nodes.size).toBe(1)
    expect(graph.getNodeById(toNodeId('15'))).toBe(restored)
    expect(restored.pos).toEqual([30, 40])
    expect(restored.title).toBe('Enable multi-image input')
    expect(restored.has_errors).toBe(false)
    expect(restored.properties).toEqual({ preserved: true })
    expect(restored.widgets[0].value).toBe(
      'Preserve this exact text after tab switching.'
    )
  })

  it('replaces an existing node when its id is reused for another type', () => {
    const { mutator, graph, created } = makeMutator()
    const stale = new FakeNode('MarkdownNote', ['text'])
    stale.id = toNodeId('15')
    graph.add(stale)

    mutator.applyBatch(
      batch({
        kind: 'add_node',
        node: {
          id: toNodeId('15'),
          type: 'LoadVideo',
          pos: [30, 40],
          widgets: { fps: 24 }
        }
      })
    )

    expect(created).toHaveLength(1)
    expect(graph.nodes.size).toBe(1)
    expect(graph.getNodeById(toNodeId('15'))).toBe(created[0])
    expect(graph.getNodeById(toNodeId('15'))?.type).toBe('LoadVideo')
    expect(graph.getNodeById(toNodeId('15'))?.widgets[0].value).toBe(24)
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

  it('sets widgets by name or opaque index and ignores an unknown name', () => {
    const { mutator, graph } = makeMutator()
    const node = new FakeNode('KSampler', ['seed', 'steps'])
    node.id = toNodeId('2')
    graph.add(node)
    mutator.applyBatch(
      batch(
        { kind: 'set_widget', id: toNodeId('2'), name: 'seed', value: 123 },
        { kind: 'set_widget', id: toNodeId('2'), name: '1', value: 50 },
        { kind: 'set_widget', id: toNodeId('2'), name: 'nope', value: 9 }
      )
    )
    expect(node.widgets.find((w) => w.name === 'seed')?.value).toBe(123)
    expect(node.widgets.find((w) => w.name === 'steps')?.value).toBe(50)
    expect(node.widgets.some((w) => w.name === 'nope')).toBe(false)
  })

  it('maps opaque indexes across serializable widgets only', () => {
    const { mutator, graph } = makeMutator()
    const node = new FakeNode('KSampler', ['seed', 'steps'])
    node.widgets.splice(1, 0, {
      name: 'control',
      value: 'unchanged',
      serialize: false
    })
    node.id = toNodeId('2')
    graph.add(node)

    mutator.applyBatch(
      batch({ kind: 'set_widget', id: toNodeId('2'), name: '1', value: 50 })
    )

    expect(node.widgets[1].value).toBe('unchanged')
    expect(node.widgets.find((widget) => widget.name === 'steps')?.value).toBe(
      50
    )
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
