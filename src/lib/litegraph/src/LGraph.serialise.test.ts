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
import { toNodeId } from '@/types/nodeId'

import { test } from './__fixtures__/testExtensions'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  mockReportError.mockClear()
})

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
    adapterOnly.id = toNodeId(99)
    graph._nodes.push(adapterOnly)

    const serialized = graph.serialize()

    expect(serialized.nodes.map(({ title }) => title)).toEqual([
      'Registered',
      'Adapter only'
    ])
    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: 'Graph serialization state mismatch'
      }),
      {
        errorType: 'graph_serialization_state_mismatch',
        context: {
          graphId: graph.id,
          mismatch: `live node ${adapterOnly.id} has no stored state`
        }
      }
    )
  })

  test('serialises a node held twice in the live array only once', ({
    expect
  }) => {
    const graph = new LGraph()
    const node = new LGraphNode('Doubled')
    graph.add(node)
    graph._nodes.push(node)

    const serialized = graph.serialize()

    expect(serialized.nodes.map(({ title }) => title)).toEqual(['Doubled'])
    expect(mockReportError).not.toHaveBeenCalled()
  })

  test('serialises a duplicated live node once through the fallback', ({
    expect
  }) => {
    const graph = new LGraph()
    const node = new LGraphNode('Doubled')
    graph.add(node)
    graph._nodes.push(node)
    const adapterOnly = new LGraphNode('Adapter only')
    adapterOnly.id = toNodeId(99)
    graph._nodes.push(adapterOnly)

    const serialized = graph.serialize()

    expect(serialized.nodes.map(({ title }) => title)).toEqual([
      'Doubled',
      'Adapter only'
    ])
    expect(mockReportError).toHaveBeenCalledOnce()
  })

  test('serialises one entry per id when distinct live nodes share an id', ({
    expect
  }) => {
    const graph = new LGraph()
    const registered = new LGraphNode('Registered')
    graph.add(registered)
    const impostor = new LGraphNode('Impostor')
    impostor.id = registered.id
    graph._nodes.push(impostor)
    const adapterOnly = new LGraphNode('Adapter only')
    adapterOnly.id = toNodeId(99)
    graph._nodes.push(adapterOnly)

    const serialized = graph.serialize()

    const ids = serialized.nodes.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(2)
    expect(new Set(ids)).toEqual(
      new Set([registered.id, adapterOnly.id].map(Number))
    )
    expect(mockReportError).toHaveBeenCalledOnce()
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

  test('binds serialization hooks to live instances with plain data arguments', ({
    expect
  }) => {
    const graph = new LGraph()
    const node = new LGraphNode('Before serialize')
    graph.add(node)

    node.onSerialize = function (data) {
      expect(this).toBe(node)
      expect(data).not.toBe(this)
      expect(Object.getPrototypeOf(data)).toBe(Object.prototype)
      this.title = 'After serialize'
    }
    graph.onSerialize = function (data) {
      expect(this).toBe(graph)
      expect(data).not.toBe(this)
      expect(Object.getPrototypeOf(data)).toBe(Object.prototype)
      this.extra.serialized = true
    }

    node.serialize()
    graph.asSerialisable()

    expect(node.title).toBe('After serialize')
    expect(graph.extra.serialized).toBe(true)
  })

  test('binds configure hooks to live instances with plain data arguments', ({
    expect
  }) => {
    const graph = new LGraph()
    const node = new LGraphNode('Before configure')
    const nodeData = node.serialize()
    const graphData = graph.asSerialisable()

    node.onConfigure = function (data) {
      expect(this).toBe(node)
      expect(data).not.toBe(this)
      expect(Object.getPrototypeOf(data)).toBe(Object.prototype)
      this.title = 'After configure'
    }
    graph.onConfigure = function (data) {
      expect(this).toBe(graph)
      expect(data).not.toBe(this)
      expect(Object.getPrototypeOf(data)).toBe(Object.prototype)
      this.extra.configured = true
    }

    node.configure(nodeData)
    graph.configure(graphData)

    expect(node.title).toBe('After configure')
    expect(graph.extra.configured).toBe(true)
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

  test('passes an isolated clone, not the caller live serialized object, to configure hooks', ({
    expect
  }) => {
    const node = new LGraphNode('Extended')
    const saved = Object.assign(node.serialize(), {
      legacyData: { retained: true }
    })
    const savedSnapshot = JSON.parse(JSON.stringify(saved))
    let configuredData: object | undefined
    node.onConfigure = (data) => {
      configuredData = data
      Object.assign(data, { mutated: true })
    }

    node.configure(saved)

    expect(configuredData).not.toBe(saved)
    expect(Reflect.get(node, 'legacyData')).toEqual({ retained: true })
    // The hook's mutation of its argument must not leak back to the caller's
    // object (https://github.com/Comfy-Org/ComfyUI_frontend/pull/15924#discussion_r3858723898).
    expect(saved).toEqual(savedSnapshot)
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
