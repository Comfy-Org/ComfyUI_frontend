import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe } from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedGraph,
  ISerialisedNode
} from '@/lib/litegraph/src/litegraph'
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

  test('falls back to live adapters when a node is missing from the store', ({
    expect
  }) => {
    const graph = new LGraph()
    const registered = new LGraphNode('Registered')
    graph.add(registered)
    const adapterOnly = new LGraphNode('Adapter only')
    graph._nodes.push(adapterOnly)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const serialized = graph.serialize()

    expect(serialized.nodes.map(({ title }) => title)).toEqual([
      'Registered',
      'Adapter only'
    ])
    expect(error).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(`live node ${adapterOnly.id} has no stored state`)
    )
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

  test('passes an isolated serialized object to configure hooks', ({
    expect
  }) => {
    const node = new LGraphNode('Extended')
    node.addInput('input', 'number')
    const saved: ISerialisedNode = Object.assign(node.serialize(), {
      inputs: node.inputs,
      legacyData: { retained: true }
    })
    let configuredData: ISerialisedNode | undefined
    node.onConfigure = (data) => {
      configuredData = data
    }

    node.configure(saved)

    expect(configuredData).not.toBe(saved)
    expect(configuredData?.inputs?.[0]).toMatchObject({
      name: 'input',
      type: 'number'
    })
    expect(configuredData?.inputs?.[0]).not.toBe(saved.inputs?.[0])
    expect(Reflect.get(node, 'legacyData')).toEqual({ retained: true })
  })

  test('serializes nested live slot adapters in configure hooks', ({
    expect,
    minimalGraph
  }) => {
    const node = new LGraphNode('Extended')
    node.addInput('input', 'number')
    minimalGraph.add(node)
    const saved = minimalGraph.asSerialisable()
    saved.nodes[0].inputs = node.inputs
    let configuredInput: object | undefined
    minimalGraph.onConfigure = (data) => {
      configuredInput = data.nodes?.[0]?.inputs?.[0]
    }

    minimalGraph.configure(saved)

    expect(configuredInput).toMatchObject({ name: 'input', type: 'number' })
    expect(configuredInput).not.toHaveProperty('node')
  })

  test('preserves non-JSON numeric and undefined values in configure hooks', ({
    expect
  }) => {
    const node = new LGraphNode('Extended')
    const saved = node.serialize()
    saved.properties = {
      absent: undefined,
      infinity: Number.POSITIVE_INFINITY,
      notANumber: Number.NaN
    }
    let configuredData: ISerialisedNode | undefined
    node.onConfigure = (data) => {
      configuredData = data
    }

    node.configure(saved)

    expect(configuredData?.properties).toHaveProperty('absent', undefined)
    expect(configuredData?.properties?.infinity).toBe(Number.POSITIVE_INFINITY)
    expect(configuredData?.properties?.notANumber).toBeNaN()
  })

  test('isolates configure-hook mutations from serialized extension data', ({
    expect
  }) => {
    const node = new LGraphNode('Extended')
    const saved = Object.assign(node.serialize(), {
      extensions: { 'example.node': { enabled: true } }
    })
    node.onConfigure = (data) => {
      const extension = data.extensions?.['example.node'] as {
        enabled: boolean
      }
      extension.enabled = false
      Object.assign(data, { 'example.node': { promoted: true } })
    }

    node.configure(saved)

    expect(saved.extensions).toEqual({
      'example.node': { enabled: true }
    })
    expect(node.serialize().extensions).toEqual({
      'example.node': { enabled: true }
    })
    expect(node.serialize()).not.toHaveProperty('example.node')
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
