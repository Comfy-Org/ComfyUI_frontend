import { assert, describe, expect, it } from 'vitest'

import { withGraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { provideExtensionHost } from '@/services/extensionHostProvider'

import { createComfyApi } from './comfyApi'
import type { ConnectionPolicy, ConnectionRule } from './connectionPolicy'
import { createDefRegistry } from './defsRegistry'
import type { NodeDefBuilder } from './defsRegistry'
import { slotIdOf } from './slotRef'

function addNode(graph: LGraph, type: string): LGraphNode {
  const node = new LGraphNode(type, type)
  node.addInput('image', 'IMAGE')
  node.addInput('extra', 'IMAGE')
  node.addOutput('image', 'IMAGE')
  graph.add(node)
  return node
}

function fixture(policy: ConnectionPolicy, graph: LGraph = new LGraph()) {
  const comfy = createComfyApi(() => graph)
  const registry = createDefRegistry()
  const defs = registry.forMajor((id) => {
    const node = comfy.graph.node(id)
    assert.exists(node)
    return node
  })
  let builder: NodeDefBuilder | undefined
  const dispose = defs.extend('Gate', (value) => {
    builder = value
    expect(value.setConnectionPolicy(policy)).toBe(true)
  })
  class Gate extends LGraphNode {
    constructor() {
      super('Gate', 'Gate')
      this.addInput('image', 'IMAGE')
      this.addInput('extra', 'IMAGE')
      this.addOutput('image', 'IMAGE')
    }
  }
  registry.applyTo(Gate, {
    name: 'Gate',
    input: { required: { image: ['IMAGE', {}], extra: ['IMAGE', {}] } },
    output: ['IMAGE'],
    output_name: ['image']
  })
  const node = new Gate()
  graph.add(node)
  assert.exists(builder)
  return { graph, comfy, registry, defs, node, builder, dispose }
}

function addWideChain(graph: LGraph): LGraphNode {
  const first = addNode(graph, 'Bridge')
  let previous = first
  for (let index = 0; index < 128; index++) {
    const next = addNode(graph, 'Bridge')
    for (let output = 1; output < 32; output++) {
      next.addOutput(`output-${output}`, 'IMAGE')
    }
    assert.exists(previous.connect(0, next, 0))
    previous = next
  }
  return first
}

describe('host-evaluated connection policy', () => {
  it('refuses invalid definition policy before registering any node type', () => {
    const { defs } = fixture({})
    const invalid = { refuseCycles: true, unknown: true }

    expect(() =>
      defs.define({
        type: 'InvalidPolicyGate',
        execution: 'frontend',
        connectionPolicy: invalid
      })
    ).toThrow('Invalid connection policy')
    expect(LiteGraph.registered_node_types).not.toHaveProperty(
      'InvalidPolicyGate'
    )
    expect(defs.has('InvalidPolicyGate')).toBe(false)
  })

  it('refuses forwarded definition policy while an external host is installed', () => {
    const { defs } = fixture({})
    provideExtensionHost({
      name: 'Policy test host',
      canLoad: () => true,
      async load() {}
    })
    try {
      expect(() =>
        defs.define({
          type: 'ForwardedPolicyGate',
          execution: 'frontend',
          connectionPolicy: { refuseCycles: true }
        })
      ).toThrow('Connection policies are unavailable')
      expect(LiteGraph.registered_node_types).not.toHaveProperty(
        'ForwardedPolicyGate'
      )
      expect(defs.has('ForwardedPolicyGate')).toBe(false)
    } finally {
      provideExtensionHost(null)
    }
  })

  it('suspends native policy under an external host and preserves it on refused updates', () => {
    const { graph, node, builder } = fixture({
      rules: [{ side: 'input', allow: 'never' }]
    })
    const peer = addNode(graph, 'Peer')
    expect(peer.connect(0, node, 0)).toBeNull()
    provideExtensionHost({
      name: 'Policy test host',
      canLoad: () => true,
      async load() {}
    })
    try {
      expect(builder.setConnectionPolicy({})).toBe(false)
      expect(peer.connect(0, node, 0)).toBeTruthy()
    } finally {
      provideExtensionHost(null)
    }

    expect(peer.connect(0, node, 1)).toBeNull()
    expect(graph.links.size).toBe(1)
  })

  it('applies a policy declared on a frontend node definition', () => {
    const { graph, defs } = fixture({})
    const stop = defs.define({
      type: 'OwnedPolicyGate',
      execution: 'frontend',
      inputs: [{ name: 'image', type: 'IMAGE' }],
      connectionPolicy: { rules: [{ side: 'input', allow: 'never' }] }
    })
    try {
      const node = LiteGraph.createNode('OwnedPolicyGate')
      assert.exists(node)
      graph.add(node)
      const peer = addNode(graph, 'Peer')

      expect(peer.connect(0, node, 0)).toBeNull()
      expect(graph.links.size).toBe(0)
    } finally {
      stop()
    }
  })

  it('refuses an incoming peer before replacing an existing input link', () => {
    const { graph, node } = fixture({
      rules: [{ side: 'input', peerTypes: ['Allowed'], allow: 'only' }]
    })
    const source = addNode(graph, 'Allowed')
    const rejected = addNode(graph, 'Other')
    const existing = source.connect(0, node, 0)
    assert.exists(existing)

    expect(rejected.connect(0, node, 0)).toBeNull()
    expect([...graph.links.values()]).toEqual([existing])
  })

  it('applies output rules to the actual target and explicit target slot', () => {
    const rule: ConnectionRule = {
      side: 'output',
      slots: ['image'],
      peerTypes: ['Consumer'],
      peerSlots: [{ index: 1 }],
      allow: 'only'
    }
    const { graph, node } = fixture({ rules: [rule] })
    const target = addNode(graph, 'Consumer')
    const other = addNode(graph, 'Other')

    expect(node.connect(0, target, 0)).toBeNull()
    expect(node.connect(0, other, 1)).toBeNull()
    expect(node.connect(0, target, 1)).toMatchObject({
      origin_id: node.id,
      origin_slot: 0,
      target_id: target.id,
      target_slot: 1
    })
  })

  it.for([
    { name: 'all ordinary nodes', through: undefined, expected: null },
    { name: 'declared transit type', through: ['Bridge'], expected: null },
    {
      name: 'unmatched transit type',
      through: ['Different'],
      expected: 'connected'
    }
  ])('checks cycles through $name', ({ through, expected }) => {
    const { graph, node } = fixture({
      refuseCycles: true,
      passThroughTypes: through
    })
    const bridge = addNode(graph, 'Bridge')
    const peer = addNode(graph, 'Peer')
    assert.exists(node.connect(0, bridge, 0))
    assert.exists(bridge.connect(0, peer, 0))

    expect(peer.connect(0, node, 0) ? 'connected' : null).toBe(expected)
  })

  it('also refuses a cycle proposed from the guarded output', () => {
    const { graph, node } = fixture({ refuseCycles: true })
    const upstream = addNode(graph, 'Upstream')
    assert.exists(upstream.connect(0, node, 0))

    expect(node.connect(0, upstream, 0)).toBeNull()
    expect(graph.links.size).toBe(1)
  })

  it('allows a reconnect to the same input but refuses a repeated source', () => {
    const { graph, node } = fixture({ refuseDuplicateSources: true })
    const source = addNode(graph, 'Source')
    assert.exists(source.connect(0, node, 0))
    assert.exists(source.connect(0, node, 0))

    expect(source.connect(0, node, 1)).toBeNull()
    expect(graph.links.size).toBe(1)
  })

  it('compares original sources through declared transit nodes', () => {
    const { graph, node } = fixture({
      refuseDuplicateSources: true,
      passThroughTypes: ['Bridge']
    })
    const source = addNode(graph, 'Source')
    const bridge = addNode(graph, 'Bridge')
    assert.exists(source.connect(0, node, 0))
    assert.exists(source.connect(0, bridge, 0))

    expect(bridge.connect(0, node, 1)).toBeNull()
    expect(graph.links.size).toBe(2)
  })

  it('evaluates a connected-input requirement from current host topology', () => {
    const { graph, node } = fixture({
      rules: [
        { side: 'output', allow: 'only', requiresConnectedInputs: ['extra'] }
      ]
    })
    const source = addNode(graph, 'Source')
    const target = addNode(graph, 'Target')
    expect(node.connect(0, target, 0)).toBeNull()
    assert.exists(source.connect(0, node, 1))

    expect(node.connect(0, target, 0)).toBeTruthy()
  })

  it('refuses a stale prerequisite even in a negative rule', () => {
    const { graph, node, builder } = fixture({
      rules: [
        { side: 'output', allow: 'never', requiresConnectedInputs: ['extra'] }
      ]
    })
    const target = addNode(graph, 'Target')
    assert.exists(node.connect(0, target, 0))
    expect(
      builder.setConnectionPolicy({
        rules: [
          {
            side: 'output',
            allow: 'never',
            requiresConnectedInputs: ['extra', 'missing']
          }
        ]
      })
    ).toBe(true)
    const links = [...graph.links.values()]

    expect(node.connect(0, target, 1)).toBeNull()
    expect([...graph.links.values()]).toEqual(links)
  })

  it('refuses exhausted prerequisite inspection without inverting the refusal', () => {
    const { graph, node } = fixture({
      rules: [
        {
          side: 'output',
          allow: 'never',
          requiresConnectedInputs: Array.from({ length: 32 }, (_, index) => ({
            index
          }))
        }
      ]
    })
    for (let index = node.inputs.length; index < 70; index++) {
      node.addInput(`input-${index}`, 'IMAGE')
    }
    const target = addNode(graph, 'Target')

    expect(node.connect(0, target, 0)).toBeNull()
    expect(graph.links.size).toBe(0)
  })

  it('applies a conditional refusal only while a declared consumer is downstream', () => {
    const { graph, node } = fixture({
      passThroughTypes: ['Bridge'],
      rules: [
        {
          side: 'input',
          peerTypes: ['Blocked'],
          allow: 'never',
          whileDownstream: ['Consumer']
        }
      ]
    })
    const blocked = addNode(graph, 'Blocked')
    const bridge = addNode(graph, 'Bridge')
    const consumer = addNode(graph, 'Consumer')
    assert.exists(blocked.connect(0, node, 0))
    assert.exists(node.connect(0, bridge, 0))
    assert.exists(bridge.connect(0, consumer, 0))

    expect(blocked.connect(0, node, 1)).toBeNull()
  })

  it('copies a policy and leaves it intact after an invalid replacement', () => {
    const types = ['Allowed']
    const { graph, node, builder } = fixture({
      rules: [{ side: 'input', peerTypes: types, allow: 'only' }]
    })
    types.push('Other')
    const invalid = { refuseCycles: false, unknown: true }
    expect(builder.setConnectionPolicy(invalid)).toBe(false)
    const other = addNode(graph, 'Other')

    expect(other.connect(0, node, 0)).toBeNull()
    expect(graph.links.size).toBe(0)
    expect(builder.setConnectionPolicy(null)).toBe(true)
    expect(other.connect(0, node, 0)).toBeTruthy()
  })

  it('releases a disposed extension without allowing its captured builder to revive it', () => {
    const { graph, node, builder, dispose } = fixture({
      rules: [{ side: 'input', allow: 'never' }]
    })
    const peer = addNode(graph, 'Peer')
    expect(peer.connect(0, node, 0)).toBeNull()
    dispose()

    expect(builder.setConnectionPolicy({ refuseCycles: true })).toBe(false)
    expect(peer.connect(0, node, 0)).toBeTruthy()
  })

  it('keeps refusals from independent extensions and native callbacks', () => {
    const { graph, node, defs, registry, dispose } = fixture({})
    defs.extend('Peer', (builder) => {
      builder.setConnectionPolicy({
        rules: [{ side: 'output', allow: 'never' }]
      })
      builder.onBeforeConnect(() => true)
    })
    defs.extend('Peer', (builder) => builder.setConnectionPolicy({}))
    class Peer extends LGraphNode {
      constructor() {
        super('Peer', 'Peer')
        this.addOutput('image', 'IMAGE')
      }
    }
    registry.applyTo(Peer, { name: 'Peer', output: ['IMAGE'] })
    const peer = new Peer()
    graph.add(peer)
    dispose()

    expect(peer.connect(0, node, 0)).toBeNull()
    expect(graph.links.size).toBe(0)
  })

  it.for(['load', 'agent-remote'] as const)(
    'restores %s commands without applying local policy',
    (source) => {
      const { graph, node } = fixture({
        rules: [{ side: 'input', allow: 'never' }]
      })
      const peer = addNode(graph, 'Peer')

      expect(
        withGraphIntentSource(source, () => peer.connect(0, node, 0))
      ).toBeTruthy()
      expect(peer.connect(0, node, 1)).toBeNull()
      expect(graph.links.size).toBe(1)
    }
  )

  it('does not resolve a peer with the same ID in another graph', () => {
    const { graph, node } = fixture({})
    const actual = addNode(graph, 'Peer')
    const foreignGraph = new LGraph()
    const foreign = new LGraphNode('Peer', 'Peer')
    foreign.addOutput('image', 'IMAGE')
    foreign.id = actual.id
    foreignGraph.add(foreign)

    expect(
      node.onConnectInput?.(0, 'IMAGE', foreign.outputs[0], foreign, 0)
    ).toBe(false)
    expect(graph.links.size).toBe(0)
    expect(foreignGraph.links.size).toBe(0)
  })

  it('refuses stale or ambiguous slot selectors without changing the graph', () => {
    const { graph, node, builder } = fixture({})
    const peer = addNode(graph, 'Peer')
    node.addInput('image', 'IMAGE')
    expect(
      builder.setConnectionPolicy({
        rules: [{ side: 'input', slots: ['image'], allow: 'only' }]
      })
    ).toBe(true)

    expect(peer.connect(0, node, 0)).toBeNull()
    expect(graph.links.size).toBe(0)
  })

  it('follows a stable slot identity after a public slot reorder', () => {
    const { graph, comfy, node, builder } = fixture({})
    const extra = slotIdOf(node.inputs[1])
    const handle = comfy.graph.node(String(node.id))
    assert.exists(handle)
    expect(
      builder.setConnectionPolicy({
        rules: [{ side: 'input', slots: [extra], allow: 'never' }]
      })
    ).toBe(true)
    handle.inputs.reorder(['extra', 'image'])
    const peer = addNode(graph, 'Peer')

    expect(peer.connect(0, node, 0)).toBeNull()
    expect(peer.connect(0, node, 1)).toBeTruthy()
  })

  it('keeps definition policy out of the saved node data', () => {
    const { node, builder } = fixture({})
    const saved = node.serialize()

    expect(builder.setConnectionPolicy({ refuseCycles: true })).toBe(true)
    expect(node.serialize()).toEqual(saved)
  })

  it('refuses a traversal beyond the work budget before changing any link', () => {
    const { graph, node } = fixture({ refuseCycles: true })
    const first = addWideChain(graph)
    assert.exists(node.connect(0, first, 0))
    const unrelated = addNode(graph, 'Unrelated')
    const links = [...graph.links.values()]

    expect(unrelated.connect(0, node, 0)).toBeNull()
    expect([...graph.links.values()]).toEqual(links)
  })

  it('rejects an oversized replacement while keeping the previous policy', () => {
    const { graph, node, builder } = fixture({
      rules: [{ side: 'input', allow: 'never' }]
    })
    const rules = Array.from({ length: 17 }, () => ({
      side: 'input' as const,
      allow: 'only' as const
    }))
    expect(builder.setConnectionPolicy({ rules })).toBe(false)
    const peer = addNode(graph, 'Peer')

    expect(peer.connect(0, node, 0)).toBeNull()
    expect(graph.links.size).toBe(0)
  })

  it('resolves real subgraph input identities despite the legacy minus-one index', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'boundary-image', type: 'IMAGE' },
        { name: 'other-image', type: 'IMAGE' }
      ]
    })
    const { node } = fixture(
      {
        refuseCycles: true,
        refuseDuplicateSources: true,
        rules: [{ side: 'input', peerSlots: ['boundary-image'], allow: 'only' }]
      },
      subgraph
    )
    const input = subgraph.inputNode.slots[0]

    expect(input.connect(node.inputs[0], node)).toMatchObject({
      origin_id: subgraph.inputNode.id,
      origin_slot: 0,
      target_id: node.id,
      target_slot: 0
    })
    expect(input.connect(node.inputs[1], node)).toBeUndefined()
    expect(subgraph.links.size).toBe(1)
  })

  it('keeps distinct boundary inputs distinct through a declared transit node', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'first', type: 'IMAGE' },
        { name: 'second', type: 'IMAGE' }
      ]
    })
    const { node } = fixture(
      {
        refuseDuplicateSources: true,
        passThroughTypes: ['Bridge']
      },
      subgraph
    )
    const bridge = addNode(subgraph, 'Bridge')
    const first = subgraph.inputNode.slots[0]
    const second = subgraph.inputNode.slots[1]
    assert.exists(first.connect(node.inputs[0], node))
    assert.exists(first.connect(bridge.inputs[0], bridge))

    expect(bridge.connect(0, node, 1)).toBeNull()
    expect(second.connect(node.inputs[1], node)).toBeTruthy()
  })

  it('evaluates output rules at an actual subgraph output without traversing its parent', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'boundary-image', type: 'IMAGE' }]
    })
    const { node, builder } = fixture(
      {
        rules: [
          { side: 'output', peerSlots: ['boundary-image'], allow: 'never' }
        ]
      },
      subgraph
    )
    const output = subgraph.outputNode.slots[0]

    expect(output.connect(node.outputs[0], node)).toBeUndefined()
    expect(subgraph.links.size).toBe(0)
    expect(builder.setConnectionPolicy({ refuseCycles: true })).toBe(true)
    expect(output.connect(node.outputs[0], node)).toMatchObject({
      origin_id: node.id,
      origin_slot: 0,
      target_id: subgraph.outputNode.id,
      target_slot: 0
    })
  })
})
