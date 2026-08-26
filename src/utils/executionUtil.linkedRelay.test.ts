/**
 * A consumer LINKED through a `defs.define` relay must reach the prompt.
 *
 * The resolution system computes the substitution correctly — the map holds
 * `relay:0 → source:0`. But the prompt builder's per-input walk goes through
 * `ExecutableNodeDTO`, whose virtual-node branch predates the resolution
 * system: it knows only the LEGACY shapes — `resolveVirtualOutput`, or
 * `getInputLink` on the SAME slot index. A relay that forwards its own input
 * passes by coincidence (the legacy passthrough happens to agree). A relay
 * whose source is computed — GetNode, which has NO inputs and finds its
 * SetNode by name — has nothing the legacy branch recognizes and is
 * "discarded": the sink's input vanishes from the prompt while the computed
 * substitution sits unused. Suppliers never hit this (they feed unconnected
 * inputs, the other branch), which is how a whole corpus of relay
 * conversions missed it.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createComfyApi } from '@/platform/nodeApi/comfyApi'
import { createDefRegistry } from '@/platform/nodeApi/defsRegistry'

import { graphToPrompt } from './executionUtil'

const cleanups: (() => void)[] = []

function registerType(type: string, build: (node: LGraphNode) => void) {
  class Generated extends LGraphNode {
    constructor() {
      super(type, type)
      build(this)
    }
  }
  LiteGraph.registerNodeType(type, Generated)
  cleanups.push(() => LiteGraph.unregisterNodeType(type))
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

describe('a linked relay in the prompt', () => {
  function setup() {
    const graph = new LGraph()
    const comfy = createComfyApi(() => graph)

    registerType('LSource', (node) => {
      node.addOutput('out', 'IMAGE')
    })
    registerType('LSink', (node) => {
      node.addInput('images', 'IMAGE')
    })

    const registry = createDefRegistry().forMajor((id) => comfy.graph.node(id)!)
    const spawn = (type: string) => {
      const node = LiteGraph.createNode(type)!
      graph.add(node)
      return node
    }
    return { graph, registry, spawn }
  }

  it('substitutes a pass-through relay and keeps the consumer input', async () => {
    const { graph, registry, spawn } = setup()
    registry.define({
      type: 'LRelay',
      execution: 'frontend',
      inputs: [{ name: 'in', type: 'IMAGE' }],
      outputs: [{ name: 'out', type: 'IMAGE' }],
      resolve: ({ self }) => ({
        0: self.input(0) ? { forwardTo: self.input(0)! } : { omit: true }
      })
    })
    cleanups.push(() => LiteGraph.unregisterNodeType('LRelay'))

    const source = spawn('LSource')
    const relay = spawn('LRelay')
    const sink = spawn('LSink')
    source.connect(0, relay, 0)
    relay.connect(0, sink, 0)

    const { output } = await graphToPrompt(graph)

    expect(String(relay.id) in output).toBe(false)
    expect(output[String(sink.id)]?.inputs?.images).toEqual([
      String(source.id),
      0
    ])
  })

  it('substitutes a computed-source relay — the Get/Set shape', async () => {
    const { graph, registry, spawn } = setup()
    // The Set half: forwards its own input, like the pass-through above.
    registry.define({
      type: 'LSet',
      execution: 'frontend',
      inputs: [{ name: 'in', type: '*' }],
      outputs: [{ name: 'out', type: '*' }],
      resolve: ({ self }) => ({
        0: self.input(0) ? { forwardTo: self.input(0)! } : { omit: true }
      })
    })
    cleanups.push(() => LiteGraph.unregisterNodeType('LSet'))
    // The Get half: NO inputs. Its source is computed — it finds the LSet by
    // type and forwards to that node's input. Nothing about this shape exists
    // on the node itself for a legacy passthrough to stumble into.
    registry.define({
      type: 'LGet',
      execution: 'frontend',
      outputs: [{ name: 'out', type: '*' }],
      resolve: ({ nodesOfType }) => {
        const setter = nodesOfType('LSet')[0]
        const source = setter?.input(0)
        return { 0: source ? { forwardTo: source } : { omit: true } }
      }
    })
    cleanups.push(() => LiteGraph.unregisterNodeType('LGet'))

    const source = spawn('LSource')
    const setNode = spawn('LSet')
    const getNode = spawn('LGet')
    const sink = spawn('LSink')
    source.connect(0, setNode, 0)
    getNode.connect(0, sink, 0)

    const { output } = await graphToPrompt(graph)

    // Both relays dissolve; the sink is wired straight to the source. An
    // absent `images` is the bug: the substitution map held
    // `get:0 → source:0` and the consumer walk never consulted it.
    expect(String(setNode.id) in output).toBe(false)
    expect(String(getNode.id) in output).toBe(false)
    expect(output[String(sink.id)]?.inputs?.images).toEqual([
      String(source.id),
      0
    ])
  })
})
