import { assert, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { transferReplacementOwnership } from '@/core/graph/nodeShell/nodeShellState'
import {
  LGraph,
  LGraphNode,
  NodeInputSlot,
  NodeOutputSlot
} from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { NodeState } from '@/types/nodeState'
import { toNodeId } from '@/types/nodeId'
import {
  createMockNodeInputSlot,
  createMockNodeOutputSlot,
  createNodeState
} from '@/utils/__tests__/litegraphTestUtils'
import type { UUID } from '@/utils/uuid'

import { useNodeDataStore } from './nodeDataStore'

const rootA: UUID = 'root-a'
type NodeSlots = Pick<NodeState, 'inputs' | 'outputs'>

function node(id: number, graphId: UUID = rootA): NodeState {
  return createNodeState({ id: toNodeId(id), graphId, title: `Node ${id}` })
}

function graphScope(rootGraphId: UUID, owningGraphId: UUID): GraphScope {
  return {
    rootGraphId: toRootGraphId(rootGraphId),
    owningGraphId: toOwningGraphId(owningGraphId)
  }
}

describe('useNodeDataStore', () => {
  it('re-runs consumers when membership changes', () => {
    const store = useNodeDataStore()
    const ids = computed(() =>
      store.getGraphNodesFor(rootA, rootA).map((n) => n.id)
    )
    expect(ids.value).toEqual([])

    const first = node(1)
    store.registerNode(graphScope(rootA, rootA), first)
    store.registerNode(graphScope(rootA, rootA), node(2))
    expect(ids.value).toEqual(['1', '2'])

    store.deleteNode(graphScope(rootA, rootA), first)
    expect(ids.value).toEqual(['2'])
  })

  it('isolates nodes by owning graph id', () => {
    const store = useNodeDataStore()
    const sub: UUID = 'sub-1'
    store.registerNode(graphScope(rootA, rootA), node(1, rootA))
    store.registerNode(graphScope(rootA, sub), node(2, sub))
    store.registerNode(graphScope(rootA, rootA), node(3, rootA))

    expect(store.getGraphNodesFor(rootA, rootA).map((n) => n.id)).toEqual([
      '1',
      '3'
    ])
    expect(store.getGraphNodesFor(rootA, sub).map((n) => n.id)).toEqual(['2'])
  })

  it('rejects a duplicate id without changing either registration', () => {
    const store = useNodeDataStore()
    const first = node(1)
    const duplicate = node(1, 'sub-1')

    const registered = store.registerNode(graphScope(rootA, rootA), first)
    const rejected = store.registerNode(graphScope(rootA, 'sub-1'), duplicate)

    expect(registered?.id).toBe(first.id)
    expect(rejected).toBeUndefined()
    expect(duplicate.graphId).toBe('sub-1')
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([registered])
    expect(store.getGraphNodesFor(rootA, 'sub-1')).toEqual([])
  })

  it('rejects the registered node identity from a sibling owner', () => {
    const store = useNodeDataStore()
    const registered = node(1)
    store.registerNode(graphScope(rootA, rootA), registered)

    expect(
      store.registerNode(graphScope(rootA, 'sub-1'), registered)
    ).toBeUndefined()
    expect(registered.graphId).toBe(rootA)
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([registered])
    expect(store.getGraphNodesFor(rootA, 'sub-1')).toEqual([])
  })

  it('only deletes the registered identity from its owning graph', () => {
    const store = useNodeDataStore()
    const registered = node(1)
    const impostor = node(1)
    store.registerNode(graphScope(rootA, rootA), registered)

    expect(store.deleteNode(graphScope(rootA, 'sub-1'), registered)).toBe(false)
    expect(store.deleteNode(graphScope(rootA, rootA), impostor)).toBe(false)
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([registered])
  })

  it('discards a deleted node when its id is reused', () => {
    const store = useNodeDataStore()
    const scope = graphScope(rootA, rootA)
    const original = node(42)
    store.registerNode(scope, original)
    store.deleteNode(scope, original)

    const replacement = node(42)
    const registered = store.registerNode(scope, replacement)

    expect(registered?.id).toBe(toNodeId(42))
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([registered])
  })

  it('reuses a deleted node id for a replacement node', () => {
    const store = useNodeDataStore()
    const first = node(1)
    const registered = store.registerNode(graphScope(rootA, rootA), first)
    assert(registered)

    expect(store.deleteNode(graphScope(rootA, rootA), registered)).toBe(true)

    const replacement = node(1, 'sub-1')
    const reRegistered = store.registerNode(
      graphScope(rootA, 'sub-1'),
      replacement
    )
    expect(reRegistered).toBeDefined()
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([])
    expect(store.getGraphNodesFor(rootA, 'sub-1')).toEqual([reRegistered])
  })

  it('updateNodeFields replaces scalar fields but never the slot arrays', () => {
    const store = useNodeDataStore()
    const scope = graphScope(rootA, rootA)
    const registered = store.registerNode(
      scope,
      createNodeState({
        id: toNodeId(1),
        graphId: rootA,
        title: 'Host',
        color: '#111',
        inputs: [createMockNodeInputSlot({ name: 'in', type: 'IMAGE' })],
        outputs: [createMockNodeOutputSlot({ name: 'out', type: 'IMAGE' })]
      })
    )
    assert(registered)
    const liveInputs = registered.inputs
    const liveOutputs = registered.outputs
    const [liveInput] = liveInputs

    expect(
      store.updateNodeFields(
        scope,
        registered.id,
        createNodeState({
          id: toNodeId(1),
          graphId: rootA,
          title: 'Renamed',
          mode: 2,
          properties: { source: 'doc' },
          // Different slot shape on purpose: it must be ignored entirely.
          inputs: [
            createMockNodeInputSlot({ name: 'in', type: 'IMAGE' }),
            createMockNodeInputSlot({ name: 'extra', type: 'MASK' })
          ],
          outputs: []
        })
      )
    ).toBe(true)

    expect(registered.title).toBe('Renamed')
    expect(registered.mode).toBe(2)
    expect(registered.properties).toEqual({ source: 'doc' })
    expect(registered.color).toBeUndefined()
    expect(registered.inputs).toBe(liveInputs)
    expect(registered.outputs).toBe(liveOutputs)
    expect(registered.inputs).toHaveLength(1)
    expect(registered.inputs[0]).toBe(liveInput)
    expect(registered.outputs).toHaveLength(1)

    expect(
      store.updateNodeFields(
        graphScope(rootA, 'sub-1'),
        registered.id,
        createNodeState({ id: toNodeId(1), graphId: 'sub-1', title: 'Wrong' })
      )
    ).toBe(false)
    expect(registered.title).toBe('Renamed')
  })

  it('updateNode refills the live slot arrays in place across a length change', () => {
    const store = useNodeDataStore()
    const scope = graphScope(rootA, rootA)
    const registered = store.registerNode(
      scope,
      createNodeState({
        id: toNodeId(1),
        graphId: rootA,
        title: 'Host',
        inputs: [createMockNodeInputSlot({ name: 'a', type: 'IMAGE' })],
        outputs: []
      })
    )
    assert(registered)
    const liveInputs = registered.inputs
    const liveOutputs = registered.outputs

    expect(
      store.updateNode(
        scope,
        registered.id,
        createNodeState({
          id: toNodeId(1),
          graphId: rootA,
          title: 'Renamed',
          inputs: [
            createMockNodeInputSlot({ name: 'a', type: 'IMAGE' }),
            createMockNodeInputSlot({ name: 'b', type: 'MASK' })
          ],
          outputs: [createMockNodeOutputSlot({ name: 'out', type: 'LATENT' })]
        })
      )
    ).toBe(true)

    expect(registered.title).toBe('Renamed')
    expect(registered.inputs).toBe(liveInputs)
    expect(registered.outputs).toBe(liveOutputs)
    expect(registered.inputs.map((slot) => [slot.name, slot.type])).toEqual([
      ['a', 'IMAGE'],
      ['b', 'MASK']
    ])
    expect(registered.outputs.map((slot) => [slot.name, slot.type])).toEqual([
      ['out', 'LATENT']
    ])
  })

  it('updateNode refills a slot list long enough to overflow a spread-based splice, without changing array identity', () => {
    const store = useNodeDataStore()
    const scope = graphScope(rootA, rootA)
    const registered = store.registerNode(
      scope,
      createNodeState({
        id: toNodeId(1),
        graphId: rootA,
        title: 'Host',
        inputs: [createMockNodeInputSlot({ name: 'seed', type: 'IMAGE' })],
        outputs: []
      })
    )
    assert(registered)
    const liveInputs = registered.inputs

    // Comfortably above this runtime's spread-argument ceiling (measured
    // around 125k on Node's current V8): `target.splice(0, target.length,
    // ...source)` throws `RangeError: Maximum call stack size exceeded`
    // here, while the index-by-index refill does not.
    const length = 150_000
    const inputs = Array.from({ length }, (_, i) =>
      createMockNodeInputSlot({ name: `input-${i}`, type: 'IMAGE' })
    )

    expect(() =>
      store.updateNode(
        scope,
        registered.id,
        createNodeState({
          id: toNodeId(1),
          graphId: rootA,
          title: 'Renamed',
          inputs,
          outputs: []
        })
      )
    ).not.toThrow()

    expect(registered.inputs).toBe(liveInputs)
    expect(registered.inputs).toHaveLength(length)
    expect(registered.inputs[0]?.name).toBe('input-0')
    expect(registered.inputs[length - 1]?.name).toBe(`input-${length - 1}`)
  })

  it.for([
    {
      slotKind: 'input',
      existing: (): NodeSlots => ({
        inputs: [createMockNodeInputSlot({ name: 'a', link: toLinkId(1) })],
        outputs: []
      }),
      incoming: (): NodeSlots => ({
        inputs: [createMockNodeInputSlot({ name: 'a', link: toLinkId(2) })],
        outputs: []
      }),
      read: (state: NodeState) => state.inputs[0]?.link,
      expected: toLinkId(2)
    },
    {
      slotKind: 'output',
      existing: (): NodeSlots => ({
        inputs: [],
        outputs: [createMockNodeOutputSlot({ name: 'a', links: [toLinkId(1)] })]
      }),
      incoming: (): NodeSlots => ({
        inputs: [],
        outputs: [
          createMockNodeOutputSlot({
            name: 'a',
            links: [toLinkId(2), toLinkId(3)]
          })
        ]
      }),
      read: (state: NodeState) => state.outputs[0]?.links,
      expected: [toLinkId(2), toLinkId(3)]
    }
  ])(
    'updates connectivity on matched plain $slotKind slots',
    ({ existing, incoming, read, expected }) => {
      const store = useNodeDataStore()
      const scope = graphScope(rootA, rootA)
      const registered = store.registerNode(
        scope,
        createNodeState({ id: toNodeId(1), graphId: rootA, ...existing() })
      )
      assert(registered)

      store.updateNodeSlots(scope, registered.id, incoming())

      expect(read(registered)).toEqual(expected)
    }
  )

  it.for([
    {
      slotKind: 'input',
      existing: (): NodeSlots => ({
        inputs: [
          createMockNodeInputSlot({ name: 'same', label: 'old-1' }),
          createMockNodeInputSlot({ name: 'same', label: 'old-2' })
        ],
        outputs: []
      }),
      incoming: (): NodeSlots => ({
        inputs: [
          createMockNodeInputSlot({ name: 'same', label: 'new-1' }),
          createMockNodeInputSlot({ name: 'same', label: 'new-2' })
        ],
        outputs: []
      }),
      read: (state: NodeState) => state.inputs.map(({ label }) => label)
    },
    {
      slotKind: 'output',
      existing: (): NodeSlots => ({
        inputs: [],
        outputs: [
          createMockNodeOutputSlot({ name: 'same', label: 'old-1' }),
          createMockNodeOutputSlot({ name: 'same', label: 'old-2' })
        ]
      }),
      incoming: (): NodeSlots => ({
        inputs: [],
        outputs: [
          createMockNodeOutputSlot({ name: 'same', label: 'new-1' }),
          createMockNodeOutputSlot({ name: 'same', label: 'new-2' })
        ]
      }),
      read: (state: NodeState) => state.outputs.map(({ label }) => label)
    }
  ])(
    'updates duplicate $slotKind names by occurrence',
    ({ existing, incoming, read }) => {
      const store = useNodeDataStore()
      const scope = graphScope(rootA, rootA)
      const registered = store.registerNode(
        scope,
        createNodeState({ id: toNodeId(1), graphId: rootA, ...existing() })
      )
      assert(registered)

      store.updateNodeSlots(scope, registered.id, incoming())

      expect(read(registered)).toEqual(['new-1', 'new-2'])
    }
  )

  it('replaces slots by name and occurrence without replacing shared arrays or matched slots', () => {
    const store = useNodeDataStore()
    const scope = graphScope(rootA, rootA)
    const inputs = [
      createMockNodeInputSlot({ name: 'same', label: 'old-1' }),
      createMockNodeInputSlot({ name: 'drop' }),
      createMockNodeInputSlot({ name: 'same', label: 'old-2' })
    ]
    const outputs = [
      createMockNodeOutputSlot({ name: 'drop' }),
      createMockNodeOutputSlot({ name: 'keep', label: 'old' })
    ]
    const registered = store.registerNode(
      scope,
      createNodeState({
        id: toNodeId(1),
        graphId: rootA,
        inputs,
        outputs
      })
    )
    assert(registered)
    const registeredInputs = registered.inputs
    const registeredOutputs = registered.outputs
    const [firstSame, , secondSame] = registeredInputs
    const [, keptOutput] = registeredOutputs

    expect(
      store.replaceNodeSlots(scope, registered.id, {
        inputs: [
          createMockNodeInputSlot({ name: 'same', label: 'new-1' }),
          createMockNodeInputSlot({ name: 'insert' }),
          createMockNodeInputSlot({ name: 'same', label: 'new-2' })
        ],
        outputs: [
          createMockNodeOutputSlot({ name: 'keep', label: 'new' }),
          createMockNodeOutputSlot({ name: 'insert' })
        ]
      })
    ).toBe(true)

    expect(registered.inputs).toBe(registeredInputs)
    expect(registered.outputs).toBe(registeredOutputs)
    expect(registered.inputs.map(({ name }) => name)).toEqual([
      'same',
      'insert',
      'same'
    ])
    expect(registered.outputs.map(({ name }) => name)).toEqual([
      'keep',
      'insert'
    ])
    expect(registered.inputs[0]).toBe(firstSame)
    expect(registered.inputs[2]).toBe(secondSame)
    expect(registered.outputs[0]).toBe(keptOutput)
    expect(registered.inputs.map(({ label }) => label)).toEqual([
      'new-1',
      undefined,
      'new-2'
    ])
    expect(registered.outputs[0]?.label).toBe('new')
  })

  it('does not replace slots through the wrong owner', () => {
    const store = useNodeDataStore()
    const registered = store.registerNode(
      graphScope(rootA, rootA),
      createNodeState({
        id: toNodeId(1),
        graphId: rootA,
        inputs: [createMockNodeInputSlot({ name: 'keep' })]
      })
    )
    assert(registered)

    expect(
      store.replaceNodeSlots(graphScope(rootA, 'sub-1'), registered.id, {
        inputs: [],
        outputs: []
      })
    ).toBe(false)
    expect(registered.inputs.map(({ name }) => name)).toEqual(['keep'])
  })
})

describe('nodeDataStore registration via LGraph', () => {
  function registeredState(graph: LGraph, node: LGraphNode) {
    return useNodeDataStore()
      .getGraphNodesFor(graph.id, graph.id)
      .find((state) => state.id === node.id)
  }

  function unknownNodeSerialization(
    node: LGraphNode,
    type = 'missing/Node'
  ): ISerialisedNode {
    return {
      ...node.serialize(),
      type,
      properties: { preserved: true },
      widgets_values: [42]
    }
  }

  it('owns unknown-node fallback through load, compatibility access, and removal', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Missing')
    const fallback = unknownNodeSerialization(source)

    graph.configure({ ...graph.asSerialisable(), nodes: [fallback] })
    const loaded = graph.nodes[0]
    assert(loaded)
    const state = registeredState(graph, loaded)

    expect(loaded.last_serialization).toBe(state?.lastSerialization)
    expect(loaded.last_serialization).toMatchObject({
      type: 'missing/Node',
      widgets_values: [42]
    })

    graph.remove(loaded)
    expect(registeredState(graph, loaded)).toBeUndefined()
  })

  it('round-trips fallback data while live store fields remain authoritative', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Missing')
    const fallback = unknownNodeSerialization(source)
    graph.configure({ ...graph.asSerialisable(), nodes: [fallback] })
    const loaded = graph.nodes[0]
    assert(loaded)

    loaded.pos = [300, 400]
    loaded.mode = 2
    assert(loaded.last_serialization)
    loaded.last_serialization = {
      ...loaded.last_serialization,
      pos: [1, 2],
      mode: 1
    }

    expect(loaded.serialize()).toEqual({
      ...fallback,
      pos: [300, 400],
      mode: 2
    })
    const serialized = structuredClone(graph.asSerialisable())
    graph.clear()
    expect(new LGraph(serialized).nodes[0]?.serialize()).toEqual({
      ...fallback,
      pos: [300, 400],
      mode: 2
    })
  })

  it('leaves fallback discovery on the removed shell during replacement', () => {
    const graph = new LGraph()
    const original = new LGraphNode('Missing')
    graph.add(original)
    original.last_serialization = unknownNodeSerialization(original)
    const replacement = new LGraphNode('Replacement')
    replacement.id = original.id

    expect(transferReplacementOwnership(original, replacement)).toBe(true)
    expect(original.last_serialization.type).toBe('missing/Node')
    expect(replacement.last_serialization).toBeUndefined()
    expect(
      registeredState(graph, replacement)?.lastSerialization
    ).toBeUndefined()
  })

  it('exposes a node’s slots without resolving the node', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    lgraphNode.addInput('model', 'MODEL')
    lgraphNode.addOutput('latent', 'LATENT')
    graph.add(lgraphNode)

    const state = registeredState(graph, lgraphNode)

    expect(state?.inputs.map((i) => i.name)).toEqual(['model'])
    expect(state?.outputs.map((o) => o.name)).toEqual(['latent'])
  })

  it('keeps live slot edits visible after a remote slot sync', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    lgraphNode.addInput('old', 'INT')
    lgraphNode.addOutput('old', 'INT')
    graph.add(lgraphNode)
    const state = registeredState(graph, lgraphNode)
    assert.exists(state)
    const inputNames = computed(() => state.inputs.map((input) => input.name))
    const outputNames = computed(() =>
      state.outputs.map((output) => output.name)
    )
    expect(inputNames.value).toEqual(['old'])
    expect(outputNames.value).toEqual(['old'])

    useNodeDataStore().updateNodeSlots(
      graphScope(graph.rootGraph.id, graph.id),
      lgraphNode.id,
      {
        inputs: [
          createMockNodeInputSlot({
            name: 'old',
            type: 'IMAGE',
            label: 'Remote input'
          })
        ],
        outputs: [
          createMockNodeOutputSlot({
            name: 'old',
            type: 'IMAGE',
            label: 'Remote output'
          })
        ]
      }
    )
    lgraphNode.addInput('image_2', 'IMAGE')
    lgraphNode.addOutput('mask', 'MASK')

    expect(inputNames.value).toEqual(['old', 'image_2'])
    expect(outputNames.value).toEqual(['old', 'mask'])
    expect(state.inputs[0]?.label).toBe('Remote input')
    expect(state.outputs[0]?.label).toBe('Remote output')
    expect(lgraphNode.inputs.map((input) => input.name)).toEqual([
      'old',
      'image_2'
    ])
    expect(lgraphNode.outputs.map((output) => output.name)).toEqual([
      'old',
      'mask'
    ])
  })

  it('reflects adds, reorders and removes without re-registration', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    lgraphNode.addInput('first', 'INT')
    graph.add(lgraphNode)
    const state = registeredState(graph, lgraphNode)

    lgraphNode.addInput('second', 'INT')
    lgraphNode.addInput('third', 'INT')
    expect(state?.inputs.map((i) => i.name)).toEqual([
      'first',
      'second',
      'third'
    ])

    // A pure permutation — the case that rules out index-based keying.
    lgraphNode.inputs = [...lgraphNode.inputs].reverse()
    expect(state?.inputs.map((i) => i.name)).toEqual([
      'third',
      'second',
      'first'
    ])

    lgraphNode.removeInput(1)
    expect(state?.inputs.map((i) => i.name)).toEqual(['third', 'first'])
  })

  it('keeps live slot arrays shared after a store update', () => {
    const graph = new LGraph()
    const live = new LGraphNode('test')
    live.addInput('first', 'INT')
    live.addOutput('result', 'INT')
    graph.add(live)
    const state = registeredState(graph, live)
    assert(state)
    const inputs = live.inputs
    const outputs = live.outputs

    expect(
      useNodeDataStore().updateNodeSlots(
        graphScope(graph.id, graph.id),
        live.id,
        { inputs: [...inputs], outputs: [...outputs] }
      )
    ).toBe(true)

    live.addInput('second', 'INT')
    live.addOutput('next', 'INT')
    expect(state.inputs).toBe(inputs)
    expect(state.outputs).toBe(outputs)
    expect(state.inputs.map((input) => input.name)).toEqual(['first', 'second'])
    expect(state.outputs.map((output) => output.name)).toEqual([
      'result',
      'next'
    ])
  })

  it('serializes a hand-made link on its actual slot after an earlier agent slot sync (PM-1449)', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    source.addOutput('out', 'IMAGE')
    graph.add(source)

    const node = new LGraphNode('test')
    node.addInput('videos.video0', 'IMAGE')
    node.addInput('codec', 'COMBO')
    graph.add(node)
    const scope = graphScope(graph.id, graph.id)

    useNodeDataStore().updateNodeSlots(scope, node.id, {
      inputs: [...node.inputs],
      outputs: [...node.outputs]
    })

    node.addInput('videos.video1', 'IMAGE')
    const grownInput = node.inputs.pop()
    assert(grownInput)
    node.inputs.splice(1, 0, grownInput)
    source.connect(0, node, 1)

    const nodeJson = graph
      .serialize()
      .nodes.find((n) => String(n.id) === String(node.id))
    const names = nodeJson?.inputs?.map((i) => i.name)

    expect(names).toEqual(['videos.video0', 'videos.video1', 'codec'])
    const linkedInput = nodeJson?.inputs?.find((i) => i.link !== null)
    expect(linkedInput?.name).toBe('videos.video1')
  })

  it('never removes or reorders a live slot missing from an agent slot sync', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    source.addOutput('out', 'IMAGE')
    graph.add(source)

    const node = new LGraphNode('test')
    node.addInput('a', 'IMAGE')
    node.addInput('b', 'IMAGE')
    node.addInput('c', 'IMAGE')
    graph.add(node)
    source.connect(0, node, 1)
    expect(node.isInputConnected(1)).toBe(true)

    const liveInputs = node.inputs
    const [liveA, , liveC] = liveInputs
    const scope = graphScope(graph.id, graph.id)
    useNodeDataStore().updateNodeSlots(scope, node.id, {
      inputs: [
        { ...liveC, name: 'c', type: 'IMAGE' },
        { ...liveA, name: 'a', type: 'IMAGE' }
      ],
      outputs: [...node.outputs]
    })

    expect(registeredState(graph, node)?.inputs).toBe(liveInputs)
    expect(node.inputs.map((i) => i.name)).toEqual(['a', 'b', 'c'])
    expect(node.inputs[0]).toBe(liveA)
    expect(node.inputs[2]).toBe(liveC)
    expect(node.isInputConnected(1)).toBe(true)
  })

  it('inserts a new synced slot at its incoming topology index', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    source.addOutput('out', 'IMAGE')
    graph.add(source)

    const node = new LGraphNode('test')
    node.addInput('a', 'IMAGE')
    node.addInput('c', 'IMAGE')
    graph.add(node)
    source.connect(0, node, 1)

    useNodeDataStore().updateNodeSlots(
      graphScope(graph.id, graph.id),
      node.id,
      {
        inputs: [
          createMockNodeInputSlot({ name: 'a', type: 'IMAGE' }),
          createMockNodeInputSlot({ name: 'b', type: 'IMAGE' }),
          createMockNodeInputSlot({ name: 'c', type: 'IMAGE' })
        ],
        outputs: []
      }
    )

    expect(node.inputs.map(({ name }) => name)).toEqual(['a', 'b', 'c'])
    expect(node.isInputConnected(1)).toBe(true)
    expect(node.isInputConnected(2)).toBe(false)
  })

  it('merges matched slot fields onto the existing object instead of replacing it', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('a', 'IMAGE')
    graph.add(node)
    const original = node.inputs[0]

    const scope = graphScope(graph.id, graph.id)
    useNodeDataStore().updateNodeSlots(scope, node.id, {
      inputs: [
        {
          name: 'a',
          type: 'IMAGE',
          label: 'renamed',
          boundingRect: [0, 0, 0, 0]
        }
      ],
      outputs: [...node.outputs]
    })

    expect(node.inputs[0]).toBe(original)
    expect(node.inputs[0].label).toBe('renamed')
  })

  it('preserves live output identity and reactivity during a partial sync', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addOutput('a', 'IMAGE')
    node.addOutput('local', 'IMAGE')
    graph.add(node)
    const store = useNodeDataStore()
    const liveOutputs = node.outputs
    const [original, local] = liveOutputs
    const label = computed(
      () => store.getNode(graph.id, node.id)?.outputs[0]?.label
    )

    store.updateNodeSlots(graphScope(graph.id, graph.id), node.id, {
      inputs: [],
      outputs: [
        createMockNodeOutputSlot({
          name: 'a',
          type: 'IMAGE',
          label: 'remote'
        })
      ]
    })

    expect(node.outputs).toBe(liveOutputs)
    expect(node.outputs[0]).toBe(original)
    expect(node.outputs[1]).toBe(local)
    expect(label.value).toBe('remote')
  })

  it('does not copy external fields into live slot internals', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('a', 'IMAGE')
    graph.add(node)
    const incoming = {
      name: 'a',
      type: 'IMAGE',
      boundingRect: [0, 0, 0, 0] as const,
      _node: new LGraphNode('payload')
    }

    useNodeDataStore().updateNodeSlots(
      graphScope(graph.id, graph.id),
      node.id,
      {
        inputs: [incoming],
        outputs: []
      }
    )

    const [liveInput] = node.inputs
    assert(liveInput instanceof NodeInputSlot)
    expect(liveInput.node).toBe(node)
  })

  it('keeps a cached computed over a merged slot field up to date', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('a', 'IMAGE')
    graph.add(node)
    const scope = graphScope(graph.id, graph.id)
    const store = useNodeDataStore()

    const label = computed(
      () => store.getNode(graph.id, node.id)?.inputs[0]?.label
    )
    expect(label.value).toBeUndefined()

    store.updateNodeSlots(scope, node.id, {
      inputs: [
        {
          name: 'a',
          type: 'IMAGE',
          label: 'remote',
          boundingRect: [0, 0, 0, 0]
        }
      ],
      outputs: [...node.outputs]
    })

    expect(label.value).toBe('remote')
  })

  it('moves registered state to a same-id replacement without changing store membership', () => {
    const graph = new LGraph()
    const original = new LGraphNode('original')
    original.color = '#123456'
    graph.add(original)
    const replacement = new LGraphNode('replacement')
    replacement.id = original.id
    const registered = registeredState(graph, original)
    assert(registered)

    expect(transferReplacementOwnership(original, replacement)).toBe(true)
    expect(replacement._state).toBe(registered)
    expect(replacement.title).toBe('replacement')
    expect(replacement.color).toBeUndefined()
    expect(registeredState(graph, replacement)).toBe(registered)
    expect(registered.graphId).toBe(graph.id)
    expect(original._graphScope).toBeUndefined()
    expect(original._state).not.toBe(registered)

    original.title = 'detached'
    expect(replacement.title).toBe('replacement')
  })

  it('transfers the latest store geometry to the replacement', () => {
    const graph = new LGraph()
    const original = new LGraphNode('original')
    graph.add(original)
    const replacement = new LGraphNode('replacement')
    replacement.id = original.id
    replacement.pos = [...original.pos]
    replacement.size = [...original.size]

    original.pos = [300, 400]
    original.size = [220, 160]

    expect(transferReplacementOwnership(original, replacement)).toBe(true)
    expect([...replacement.pos]).toEqual([300, 400])
    expect([...replacement.size]).toEqual([220, 160])
  })

  it('keeps ownership unchanged when replacement identity does not match', () => {
    const graph = new LGraph()
    const original = new LGraphNode('original')
    graph.add(original)
    const replacement = new LGraphNode('replacement')
    const registered = registeredState(graph, original)

    expect(transferReplacementOwnership(original, replacement)).toBe(false)
    expect(registeredState(graph, original)).toBe(registered)
    expect(original._graphScope).toBeDefined()
    expect(replacement._graphScope).toBeUndefined()
  })

  it('never reads the deprecated link accessor merging a node’s own unchanged live slots into itself', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    source.addOutput('out', 'IMAGE')
    graph.add(source)

    const node = new LGraphNode('test')
    node.addInput('in', 'IMAGE')
    graph.add(node)
    source.connect(0, node, 0)
    expect(node.isInputConnected(0)).toBe(true)
    expect(source.isOutputConnected(0)).toBe(true)

    const inputLinkGetter = vi.spyOn(NodeInputSlot.prototype, 'link', 'get')
    const outputLinksGetter = vi.spyOn(NodeOutputSlot.prototype, 'links', 'get')
    const scope = graphScope(graph.id, graph.id)
    const store = useNodeDataStore()

    store.updateNodeSlots(scope, node.id, {
      inputs: node.inputs,
      outputs: [...node.outputs]
    })
    store.updateNodeSlots(scope, source.id, {
      inputs: [...source.inputs],
      outputs: source.outputs
    })

    expect(inputLinkGetter).not.toHaveBeenCalled()
    expect(outputLinksGetter).not.toHaveBeenCalled()
    expect(node.isInputConnected(0)).toBe(true)
    expect(source.isOutputConnected(0)).toBe(true)
  })

  it('drops the registration when the node is removed', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    graph.add(lgraphNode)

    graph.remove(lgraphNode)

    expect(registeredState(graph, lgraphNode)).toBeUndefined()
  })

  it('does not crash the litegraph module graph on load', async () => {
    vi.resetModules()
    await import('@/lib/litegraph/src/LGraphGroup')
    await import('@/stores/nodeDataStore')
    const { SubgraphNode } =
      await import('@/lib/litegraph/src/subgraph/SubgraphNode')

    expect(SubgraphNode).toBeTypeOf('function')
  })
})
