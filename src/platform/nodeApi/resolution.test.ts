/**
 * The proving cases for frontend-node resolution: Reroute and SetNode/GetNode,
 * declared through `defs.define` and resolved by the pure pass — the two
 * archetypes `applyToGraph` existed for.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from './comfyApi'
import type { Comfy } from './comfyApi'
import { createDefRegistry, frontendResolverMap } from './defsRegistry'
import type { DefRegistry } from './defsRegistry'
import { resolveFrontendNodes } from './resolution'

describe('frontend-node resolution', () => {
  let graph: LGraph
  let defs: DefRegistry
  let comfy: Comfy
  const cleanups: (() => void)[] = []

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
    defs = createDefRegistry().forMajor((id) => comfy.graph.node(id)!)

    class TestSource extends LGraphNode {
      constructor() {
        super('TestSource')
        this.addOutput('out', '*')
      }
    }
    LiteGraph.registerNodeType('TestSource', TestSource)
    cleanups.push(() => LiteGraph.unregisterNodeType('TestSource'))
  })

  afterEach(() => {
    while (cleanups.length) cleanups.pop()!()
  })

  const spawn = (type: string) => {
    const node = LiteGraph.createNode(type)!
    graph.add(node)
    return node
  }

  const defineReroute = () =>
    cleanups.push(
      defs.define({
        type: 'TestReroute',
        execution: 'frontend',
        inputs: [{ name: 'in', type: '*' }],
        outputs: [{ name: 'out', type: '*' }],
        resolve: ({ self }) => ({ out: { forwardTo: self.input('in')! } })
      })
    )

  it('resolves a reroute chain to the real source', () => {
    defineReroute()
    const source = spawn('TestSource')
    const r1 = spawn('TestReroute')
    const r2 = spawn('TestReroute')
    source.connect(0, r1, 0)
    r1.connect(0, r2, 0)

    const resolved = resolveFrontendNodes(graph, frontendResolverMap())
    expect(resolved.get(`${r2.id}:0`)).toEqual({
      kind: 'output',
      nodeId: String(source.id),
      output: 0
    })
  })

  it('resolves GetNode to the source feeding its matching SetNode', () => {
    cleanups.push(
      defs.define({
        type: 'TestSetNode',
        execution: 'frontend',
        inputs: [{ name: 'value', type: '*' }],
        widgets: [{ type: 'string', name: 'key', value: '' }]
      })
    )
    cleanups.push(
      defs.define({
        type: 'TestGetNode',
        execution: 'frontend',
        outputs: [{ name: 'value', type: '*' }],
        widgets: [{ type: 'string', name: 'key', value: '' }],
        resolve: ({ self, nodesOfType }) => {
          const wanted = self.widgetValue('key')
          const setter = nodesOfType('TestSetNode').find(
            (candidate) => candidate.widgetValue('key') === wanted
          )
          return {
            value: setter
              ? { forwardTo: setter.input('value')! }
              : { omit: true }
          }
        }
      })
    )

    const source = spawn('TestSource')
    const setter = spawn('TestSetNode')
    const getter = spawn('TestGetNode')
    source.connect(0, setter, 0)
    setter.widgets!.find((w) => w.name === 'key')!.value = 'latents'
    getter.widgets!.find((w) => w.name === 'key')!.value = 'latents'

    const resolved = resolveFrontendNodes(graph, frontendResolverMap())
    expect(resolved.get(`${getter.id}:0`)).toEqual({
      kind: 'output',
      nodeId: String(source.id),
      output: 0
    })
  })

  it('omits a GetNode whose key matches no SetNode, without failing the pass', () => {
    cleanups.push(
      defs.define({
        type: 'TestGetNode',
        execution: 'frontend',
        outputs: [{ name: 'value', type: '*' }],
        widgets: [{ type: 'string', name: 'key', value: 'orphan' }],
        resolve: () => ({ value: { omit: true } })
      })
    )
    const getter = spawn('TestGetNode')
    const resolved = resolveFrontendNodes(graph, frontendResolverMap())
    expect(resolved.get(`${getter.id}:0`)?.kind).toBe('omitted')
  })

  it('terminates on a cycle and marks it, rather than hanging', () => {
    defineReroute()
    const r1 = spawn('TestReroute')
    const r2 = spawn('TestReroute')
    r1.connect(0, r2, 0)
    r2.connect(0, r1, 0)

    const resolved = resolveFrontendNodes(graph, frontendResolverMap())
    const outcome = resolved.get(`${r1.id}:0`)
    expect(outcome?.kind).toBe('omitted')
    expect((outcome as { reason: string }).reason).toMatch(/cycle/)
  })

  it('leaves the graph untouched even when a resolver throws', () => {
    // The property applyToGraph structurally cannot have: it mutates the live
    // graph as it goes, so a throw halfway leaves the document corrupted.
    cleanups.push(
      defs.define({
        type: 'TestBroken',
        execution: 'frontend',
        outputs: [{ name: 'out', type: '*' }],
        resolve: () => {
          throw new Error('resolver bug')
        }
      })
    )
    spawn('TestBroken')
    const before = JSON.stringify(graph.serialize())

    expect(() => resolveFrontendNodes(graph, frontendResolverMap())).toThrow(
      'resolver bug'
    )
    expect(JSON.stringify(graph.serialize())).toBe(before)
  })

  it('keeps a defined frontend node out of executable output via the legacy flag', () => {
    // Until the prompt builder consumes the resolution map directly, the
    // current serializer's isVirtualNode check is what omits these nodes —
    // define() sets it, without ever exposing applyToGraph.
    defineReroute()
    const reroute = spawn('TestReroute')
    expect(reroute.isVirtualNode).toBe(true)
    expect((reroute as { applyToGraph?: unknown }).applyToGraph).toBeUndefined()
  })
})
