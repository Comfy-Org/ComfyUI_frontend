import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe } from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'

import { test } from './__fixtures__/testExtensions'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

describe('LGraph Serialisation', () => {
  test('can (de)serialise node / group titles', ({ expect, minimalGraph }) => {
    const nodeTitle = 'Test Node'
    const groupTitle = 'Test Group'

    minimalGraph.add(new LGraphNode(nodeTitle))
    minimalGraph.add(new LGraphGroup(groupTitle))

    expect(minimalGraph.nodes.length).toBe(1)
    expect(minimalGraph.nodes[0].title).toEqual(nodeTitle)

    expect(minimalGraph.groups.length).toBe(1)
    expect(minimalGraph.groups[0].title).toEqual(groupTitle)

    const serialised = JSON.stringify(minimalGraph.serialize())
    const deserialised = JSON.parse(serialised) as ISerialisedGraph
    minimalGraph.clear()

    const copied = new LGraph(deserialised)
    expect(copied.nodes.length).toBe(1)
    expect(copied.groups.length).toBe(1)
  })

  test('registers connected links after a JSON round trip', ({ expect }) => {
    class ConnectedNode extends LGraphNode {
      constructor() {
        super('Connected')
        this.addInput('input', 'number')
        this.addOutput('output', 'number')
      }
    }

    LiteGraph.registerNodeType('test/connected', ConnectedNode)
    const graph = new LGraph()
    const source = LiteGraph.createNode('test/connected', 'Source')!
    const target = LiteGraph.createNode('test/connected', 'Target')!
    graph.add(source)
    graph.add(target)
    const link = source.connect(0, target, 0)!

    const expectedLink = {
      id: link.id,
      originNodeId: source.id,
      originSlot: 0,
      targetNodeId: target.id,
      targetSlot: 0
    }
    const serialised = JSON.stringify(graph.serialize())
    graph.clear()

    const copied = new LGraph(JSON.parse(serialised) as ISerialisedGraph)
    const copiedLink = useLinkStore().getInputSlotLink(
      graphScopeOf(copied),
      expectedLink.targetNodeId,
      expectedLink.targetSlot
    )

    expect(copiedLink).toMatchObject(expectedLink)
  })

  test('round trips namespaced node and graph extension payloads', ({
    expect,
    minimalGraph
  }) => {
    const node = new LGraphNode('Extended')
    minimalGraph.add(node)
    node.onSerialize = (data) => {
      data.extensions = { 'example.node': { enabled: true } }
    }
    minimalGraph.onSerialize = (data) => {
      data.revision = 999
      data.extensions = { 'example.graph': { version: 1 } }
    }

    const saved = structuredClone(minimalGraph.asSerialisable())
    expect(saved.revision).toBe(999)
    minimalGraph.clear()
    const copied = new LGraph()
    copied.configure(saved)

    expect(copied.asSerialisable().extensions).toEqual({
      'example.graph': { version: 1 }
    })
    expect(copied.nodes[0].serialize().extensions).toEqual({
      'example.node': { enabled: true }
    })
  })

  test('preserves canonical hook mutations while isolating legacy payloads', ({
    expect,
    minimalGraph
  }) => {
    const node = new LGraphNode('Canonical')
    minimalGraph.add(node)
    node.onSerialize = (data) => {
      data.pos = [999, 999]
      Object.assign(data, { legacyData: { retained: true } })
    }

    const saved = node.serialize()
    expect(saved.pos).toEqual([999, 999])
    expect(saved.extensions).toEqual({ legacyData: { retained: true } })
    expect(Reflect.get(saved, 'legacyData')).toEqual({ retained: true })

    let configuredLegacyData: unknown
    node.onConfigure = (data) => {
      configuredLegacyData = Reflect.get(data, 'legacyData')
    }
    node.configure(Object.assign(saved, { legacyData: { retained: true } }))

    expect(configuredLegacyData).toEqual({ retained: true })
    expect(Reflect.get(node, 'legacyData')).toEqual({ retained: true })
  })

  test('passes the original serialized object to configure hooks', ({
    expect
  }) => {
    const node = new LGraphNode('Extended')
    const saved = Object.assign(node.serialize(), {
      legacyData: { retained: true }
    })
    let configuredData: object | undefined
    node.onConfigure = (data) => {
      configuredData = data
    }

    node.configure(saved)

    expect(configuredData).toBe(saved)
    expect(Reflect.get(node, 'legacyData')).toEqual({ retained: true })
  })

  test('does not apply unsafe extension keys to the configure view', ({
    expect
  }) => {
    const node = new LGraphNode('Extended')
    const saved = node.serialize()
    saved.extensions = Object.fromEntries([['__proto__', { polluted: true }]])
    let configuredPrototype: object | null | undefined
    node.onConfigure = (data) => {
      configuredPrototype = Object.getPrototypeOf(data)
    }

    node.configure(saved)

    expect(configuredPrototype).toBe(Object.prototype)
    expect(node.serialize().extensions).toBeUndefined()
  })

  test('isolates graph extension payloads from graph properties', ({
    expect
  }) => {
    const graph = new LGraph()
    let configuredData: object | undefined
    graph.onConfigure = (data) => {
      configuredData = data
    }

    graph.configure(
      Object.assign(graph.asSerialisable(), {
        extensions: { namespaced: { enabled: true } },
        legacyData: { retained: true }
      })
    )

    expect(configuredData).toMatchObject({
      namespaced: { enabled: true },
      legacyData: { retained: true }
    })
    expect(graph.asSerialisable().extensions).toEqual({
      namespaced: { enabled: true },
      legacyData: { retained: true }
    })
    expect(Object.hasOwn(graph, 'extensions')).toBe(false)
    expect(Reflect.get(graph, 'legacyData')).toEqual({ retained: true })

    const clean = graph.asSerialisable()
    delete clean.extensions
    Reflect.deleteProperty(clean, 'legacyData')
    graph.configure(clean)
    expect(configuredData).not.toHaveProperty('legacyData')
    expect(graph.asSerialisable().extensions).toBeUndefined()
    expect(Object.hasOwn(graph, 'extensions')).toBe(false)
    expect(Object.hasOwn(graph, 'legacyData')).toBe(false)
  })

  test('removes namespaced extension payload keys across serializations', ({
    expect,
    minimalGraph
  }) => {
    const node = new LGraphNode('Extended')
    minimalGraph.add(node)
    node.onSerialize = (data) => {
      data.extensions = { 'example.node': { enabled: true } }
    }
    minimalGraph.onSerialize = (data) => {
      data.extensions = { 'example.graph': { version: 1 } }
    }

    expect(node.serialize().extensions).toHaveProperty('example.node')
    expect(minimalGraph.asSerialisable().extensions).toHaveProperty(
      'example.graph'
    )

    node.onSerialize = (data) => {
      delete data.extensions?.['example.node']
    }
    minimalGraph.onSerialize = (data) => {
      delete data.extensions?.['example.graph']
    }

    expect(node.serialize().extensions).toBeUndefined()
    expect(minimalGraph.asSerialisable().extensions).toBeUndefined()
  })

  test('retains legacy flat payload updates across serializations', ({
    expect,
    minimalGraph
  }) => {
    const node = new LGraphNode('Extended')
    minimalGraph.add(node)
    node.onSerialize = (data) => {
      Object.assign(data, { legacyData: { version: 1 } })
    }
    expect(node.serialize().extensions).toEqual({
      legacyData: { version: 1 }
    })

    node.onSerialize = (data) => {
      Object.assign(data, { legacyData: { version: 2 } })
    }
    expect(node.serialize().extensions).toEqual({
      legacyData: { version: 2 }
    })
  })

  test('drops cyclic extension payloads without aborting serialization', ({
    expect
  }) => {
    const node = new LGraphNode('Extended')
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    node.onSerialize = (data) => {
      Object.assign(data, { cyclic })
    }

    expect(() => node.serialize()).not.toThrow()
    expect(node.serialize()).not.toHaveProperty('extensions.cyclic')
    expect(warn).toHaveBeenCalledWith(
      'LiteGraph: ignoring non-serializable extension payload'
    )
  })
})
