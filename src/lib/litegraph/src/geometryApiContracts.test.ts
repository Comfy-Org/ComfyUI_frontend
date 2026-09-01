import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  Reroute
} from '@/lib/litegraph/src/litegraph'
import { toRerouteId } from '@/types/rerouteId'

describe('geometry API contracts', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('exposes entity-specific geometry write APIs', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    const group = new LGraphGroup('group')
    const reroute = new Reroute(toRerouteId(1), graph, [0, 0])

    expect(typeof node.setPos).toBe('function')
    expect(typeof node.setSize).toBe('function')
    expect('pos' in group).toBe(true)
    expect('size' in group).toBe(true)
    expect('setPos' in group).toBe(false)
    expect('setSize' in group).toBe(false)
    expect('pos' in reroute).toBe(true)
    expect('size' in reroute).toBe(false)
    expect('setPos' in reroute).toBe(false)
    expect('setSize' in reroute).toBe(false)
  })

  it('rejects malformed reroute positions while attached and detached', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    source.addOutput('output', '*')
    const target = new LGraphNode('target')
    target.addInput('input', '*')
    graph.add(source)
    graph.add(target)
    const reroute = graph.createReroute(
      [10, 20],
      source.connect(0, target, 0)!
    )!

    expect(graph.reroutes.get(reroute.id)).toBe(reroute)
    expect(() => Reflect.set(reroute, 'pos', [])).toThrow(TypeError)
    graph.removeReroute(reroute.id)
    expect(graph.reroutes.has(reroute.id)).toBe(false)
    expect(() => Reflect.set(reroute, 'pos', [1])).toThrow(TypeError)
    expect([...reroute.pos]).toEqual([10, 20])
  })
})
