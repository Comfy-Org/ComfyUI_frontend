/**
 * Resolvers and suppliers that answer asynchronously.
 *
 * A sandboxed pack's `resolve`/`supply` runs in a worker, so its answer can
 * only ever arrive as a promise. The prompt path is already async and must
 * await it — a GetNode whose resolver cannot be awaited serializes a node the
 * backend has never heard of, which is a wire break, not a degradation.
 *
 * The synchronous entry points (`input.resolvedSource()`,
 * `graph.resolvedSupplies()`) cannot await. For those, an async answer is
 * treated as unresolved — loudly, because a resolver that silently stops
 * resolving is how a pack ships broken with green checks.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import {
  resolveFrontendNodes,
  resolveFrontendNodesAsync,
  resolveSuppliedInputs,
  resolveSuppliedInputsAsync
} from './resolution'
import type { Resolver, Supplier } from './resolution'

const TYPES = ['ASource', 'ARelay', 'AConsumer']

describe('async resolution', () => {
  let graph: LGraph

  beforeEach(() => {
    setActivePinia(createPinia())
    for (const type of TYPES) {
      class Node extends LGraphNode {
        constructor() {
          super(type, type)
        }
      }
      LiteGraph.registerNodeType(type, Node)
    }
    graph = new LGraph()
  })

  const spawn = (type: string) => {
    const node = LiteGraph.createNode(type)!
    graph.add(node)
    return node
  }

  function relayChain() {
    const source = spawn('ASource')
    source.addOutput('out', '*')
    const relay = spawn('ARelay')
    relay.addInput('in', '*')
    relay.addOutput('out', '*')
    source.connect(0, relay, 0)
    return { source, relay }
  }

  it('awaits a promise-returning resolver on the prompt path', async () => {
    const { source, relay } = relayChain()
    const resolver: Resolver = async ({ self }) => ({
      0: self.input(0) ? { forwardTo: self.input(0)! } : { omit: true }
    })

    const resolved = await resolveFrontendNodesAsync(
      graph,
      new Map([['ARelay', resolver]])
    )

    expect(resolved.get(`${relay.id}:0`)).toEqual({
      kind: 'output',
      nodeId: String(source.id),
      output: 0
    })
  })

  it('treats an async resolver as unresolved on the sync path, loudly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { relay } = relayChain()
    const resolver: Resolver = async () => ({ 0: { omit: true } })

    const resolved = resolveFrontendNodes(
      graph,
      new Map([['ARelay', resolver]])
    )

    // Omitted, not forwarded and not left looking like a real output — a
    // relay whose answer cannot be known must produce nothing, because
    // omitting leaves an input unfed while a wrong forward lies on the wire.
    expect(resolved.get(`${relay.id}:0`)).toMatchObject({ kind: 'omitted' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ARelay'))
  })

  it('awaits a promise-returning supplier on the prompt path', async () => {
    const broadcaster = spawn('ASource')
    broadcaster.addOutput('out', 'MODEL')
    const consumer = spawn('AConsumer')
    consumer.addInput('model', 'MODEL')

    const supplier: Supplier = async () => [
      {
        from: { output: 0 },
        to: { nodeId: String(consumer.id), input: 0 }
      }
    ]

    const supplied = await resolveSuppliedInputsAsync(
      graph,
      new Map([['ASource', supplier]]),
      new Map()
    )

    expect(supplied.get(`${consumer.id}:0`)).toEqual({
      kind: 'output',
      nodeId: String(broadcaster.id),
      output: 0
    })
  })

  it('treats an async supplier as supplying nothing on the sync path, loudly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broadcaster = spawn('ASource')
    broadcaster.addOutput('out', 'MODEL')
    const consumer = spawn('AConsumer')
    consumer.addInput('model', 'MODEL')

    const supplier: Supplier = async () => [
      { from: { output: 0 }, to: { nodeId: String(consumer.id), input: 0 } }
    ]

    const supplied = resolveSuppliedInputs(
      graph,
      new Map([['ASource', supplier]]),
      new Map()
    )

    expect(supplied.size).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ASource'))
  })
})
