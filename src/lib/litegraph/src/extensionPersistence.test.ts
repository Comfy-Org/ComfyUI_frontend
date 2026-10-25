import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import {
  LGraph,
  LGraphNode,
  NodeInputSlot
} from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

function nodeWithNamespacedExtension(): ISerialisedNode {
  return {
    id: 1,
    type: 'TestNode',
    pos: [0, 0],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    extensions: { myExt: { note: 'hello' } }
  }
}

describe('LGraphNode.configure onConfigure hook isolation', () => {
  it('hands onConfigure a shallow copy, not the caller live serialized object', () => {
    const node = new LGraphNode('TestNode')
    const canonical = nodeWithNamespacedExtension()

    let hookArg: unknown
    node.onConfigure = (data) => {
      hookArg = data
      Object.assign(data, { mutated: true })
      Reflect.deleteProperty(data, 'size')
    }

    node.configure(canonical)

    expect(hookArg).not.toBe(canonical)
    expect(canonical).not.toHaveProperty('mutated')
    expect(canonical).not.toHaveProperty('myExt')
    expect(canonical.size).toEqual([200, 100])
    expect(canonical.extensions).toEqual({ myExt: { note: 'hello' } })
  })

  it('does not promote namespaced extension keys onto the caller serialized object', () => {
    const node = new LGraphNode('TestNode')
    node.onConfigure = (data) => {
      expect(Reflect.get(data, 'myExt')).toEqual({ note: 'hello' })
    }
    const info = nodeWithNamespacedExtension()

    node.configure(info)

    expect(info).not.toHaveProperty('myExt')
    expect(info.extensions).toEqual({ myExt: { note: 'hello' } })

    const serialized = node.serialize()
    expect(serialized).not.toHaveProperty('myExt')
    expect(serialized.extensions).toEqual({ myExt: { note: 'hello' } })
  })

  it('accepts a serialized object that still holds live slot instances', () => {
    const node = new LGraphNode('TestNode')
    node.addInput('in', 'number')
    const liveSlot = new NodeInputSlot({ name: 'in', type: 'number' }, node)
    const info: ISerialisedNode = {
      ...nodeWithNamespacedExtension(),
      inputs: [liveSlot]
    }

    let hookArg: ISerialisedNode | undefined
    node.onConfigure = (data) => {
      hookArg = data
    }

    expect(() => node.configure(info)).not.toThrow()
    expect(hookArg).not.toBe(info)
    expect(hookArg?.inputs).toBe(info.inputs)
    expect(hookArg?.inputs?.[0]).toBe(liveSlot)
  })

  it('keeps a missing-node placeholder free of promoted keys after onConfigure mutates its view', () => {
    const node = new LGraphNode('TestNode')
    node.onConfigure = (data) => {
      Object.assign(data, { mutated: true })
    }
    const info = nodeWithNamespacedExtension()

    node.configure(info)
    node.last_serialization = info

    const reserialized = node.serialize()

    expect(reserialized).not.toHaveProperty('myExt')
    expect(reserialized).not.toHaveProperty('mutated')
  })
})

describe('LGraphNode extension field serialization', () => {
  it('does not throw when an extension value is a Proxy over plain JSON', () => {
    const node = new LGraphNode('TestNode')
    const extensionValue = new Proxy({ tags: ['a', 'b'], count: 2 }, {})
    node.onSerialize = (data) => {
      Reflect.set(data, 'thirdPartyData', extensionValue)
    }

    const serialized = node.serialize()

    expect(serialized.extensions).toEqual({
      thirdPartyData: { tags: ['a', 'b'], count: 2 }
    })
  })

  it('preserves plain data from a proxy containing a function', () => {
    const node = new LGraphNode('TestNode')
    const extensionValue = new Proxy(
      {
        label: 'survives',
        callback: () => 'not serializable'
      },
      {}
    )
    node.onSerialize = (data) => {
      Reflect.set(data, 'thirdPartyData', extensionValue)
    }

    const serialized = node.serialize()

    expect(serialized.extensions).toEqual({
      thirdPartyData: { label: 'survives' }
    })
  })

  it('deep-clones proxied extension data', () => {
    const node = new LGraphNode('TestNode')
    const target = { settings: { enabled: true } }
    const extensionValue = new Proxy(target, {})
    node.onSerialize = (data) => {
      Reflect.set(data, 'thirdPartyData', extensionValue)
    }

    const serialized = node.serialize()
    target.settings.enabled = false

    expect(serialized.extensions).toEqual({
      thirdPartyData: { settings: { enabled: true } }
    })
  })
})

describe('LGraphNode legacy extension field fallbacks', () => {
  it('keeps sibling extension fields when one getter throws', () => {
    const node = new LGraphNode('TestNode')
    node.onSerialize = (data) => {
      Object.defineProperty(data, 'brokenExt', {
        enumerable: true,
        get(): never {
          throw new Error('accessor failed')
        }
      })
      Reflect.set(data, 'healthyExt', { note: 'kept' })
    }

    const serialized = node.serialize()

    expect(serialized.extensions).toEqual({ healthyExt: { note: 'kept' } })
  })
})

describe('LGraphNode extension payload fallbacks', () => {
  it('serializes a Proxy in the namespaced extension payload', () => {
    const node = new LGraphNode('TestNode')
    const extensionValue = new Proxy({ source: 'namespaced' }, {})
    node.onSerialize = (data) => {
      Reflect.set(data, 'extensions', { thirdPartyData: extensionValue })
    }

    const serialized = node.serialize()

    expect(serialized.extensions).toEqual({
      thirdPartyData: { source: 'namespaced' }
    })
  })

  it('omits an extension value when both clone strategies fail', () => {
    const node = new LGraphNode('TestNode')
    const extensionValue = new Proxy(
      { label: 'not serializable' },
      {
        get(target, property, receiver) {
          if (property === 'toJSON') throw new Error('Cannot serialize')
          return Reflect.get(target, property, receiver)
        }
      }
    )
    node.onSerialize = (data) => {
      Reflect.set(data, 'thirdPartyData', extensionValue)
    }

    const serialized = node.serialize()

    expect(serialized.extensions).toBeUndefined()
  })

  it('keeps sibling namespaced entries when one entry cannot be cloned', () => {
    const node = new LGraphNode('TestNode')
    const brokenValue = new Proxy(
      { label: 'not serializable' },
      {
        get(target, property, receiver) {
          if (property === 'toJSON') throw new Error('Cannot serialize')
          return Reflect.get(target, property, receiver)
        }
      }
    )
    node.onSerialize = (data) => {
      Reflect.set(data, 'extensions', {
        brokenExt: brokenValue,
        healthyExt: { note: 'kept' }
      })
    }

    const serialized = node.serialize()

    expect(serialized.extensions).toEqual({ healthyExt: { note: 'kept' } })
  })

  it('omits only the entries whose accessors throw while serializing', () => {
    const node = new LGraphNode('TestNode')
    node.onSerialize = (data) => {
      Reflect.set(data, 'extensions', {
        get brokenGetter(): never {
          throw new Error('accessor failed')
        },
        nestedBroken: {
          get inner(): never {
            throw new Error('nested accessor failed')
          }
        },
        healthyExt: { note: 'kept' }
      })
    }

    const serialized = node.serialize()

    expect(serialized.extensions).toEqual({ healthyExt: { note: 'kept' } })
  })
})

describe('serialize output detaches live state that hooks hand back', () => {
  function nodeInGraph() {
    const graph = new LGraph()
    const node = new LGraphNode('TestNode')
    graph.add(node)
    node.properties.elapsed = '00:01:000'
    return { graph, node }
  }

  it('copies a canonical field an onSerialize hook replaced with live node state', () => {
    const { node } = nodeInGraph()
    node.onSerialize = function (o) {
      o.properties = this.properties
    }

    const serialised = node.serialize()

    expect(serialised.properties).toEqual({ elapsed: '00:01:000' })
    expect(() => structuredClone(serialised)).not.toThrow()
  })

  it('keeps the whole graph serialization cloneable with such a hook', () => {
    const { graph, node } = nodeInGraph()
    node.onSerialize = function (o) {
      o.properties = this.properties
    }

    expect(() => structuredClone(graph.serialize())).not.toThrow()
  })

  it('does not let later live edits leak into an already serialized node', () => {
    const { node } = nodeInGraph()
    node.onSerialize = function (o) {
      o.properties = this.properties
    }

    const serialised = node.serialize()
    node.properties.elapsed = '00:02:000'

    expect(serialised.properties).toEqual({ elapsed: '00:01:000' })
  })

  it('copies a canonical graph field a graph onSerialize hook replaced with a proxy', () => {
    const graph = new LGraph()
    graph.onSerialize = (data) => {
      data.extra = reactive({ note: 'live' })
    }

    const serialised = graph.serialize()

    expect(serialised.extra).toMatchObject({ note: 'live' })
    expect(() => structuredClone(serialised)).not.toThrow()
  })

  it('detaches a live nested value a hook writes into an untouched canonical field', () => {
    const { node } = nodeInGraph()
    node.properties.cfg = { mode: 'a' }
    node.onSerialize = function (o) {
      o.properties!.cfg = this.properties.cfg
    }

    const serialised = node.serialize()

    expect(serialised.properties).toMatchObject({ cfg: { mode: 'a' } })
    expect(() => structuredClone(serialised)).not.toThrow()
  })

  it('keeps a canonical field the hook left untouched at full fidelity', () => {
    const graph = new LGraph()
    graph.extra.savedAt = new Date(0)
    graph.onSerialize = () => {}

    expect(graph.serialize().extra?.savedAt).toStrictEqual(new Date(0))
  })

  it('detaches a proxy a graph hook writes into the existing extra', () => {
    const graph = new LGraph()
    graph.onSerialize = (data) => {
      data.extra!.live = reactive({ note: 'live' })
    }

    const serialised = graph.serialize()

    expect(serialised.extra?.live).toEqual({ note: 'live' })
    expect(() => structuredClone(serialised)).not.toThrow()
  })

  it('keeps pos and size as arrays when a hook hands back the live views', () => {
    const { node } = nodeInGraph()
    node.pos = [10, 20]
    node.size = [180, 75]
    node.onSerialize = function (o) {
      o.pos = this.pos
      o.size = this.size
    }

    const serialised = node.serialize()

    expect(serialised.pos).toStrictEqual([10, 20])
    expect(serialised.size).toStrictEqual([180, 75])
    expect(() => structuredClone(serialised)).not.toThrow()
  })

  it('keeps a nested live geometry view as an array', () => {
    const { node } = nodeInGraph()
    node.onSerialize = function (o) {
      o.properties = { savedSize: this.size }
    }

    const serialised = node.serialize()

    expect(serialised.properties?.savedSize).toStrictEqual([...node.size])
    expect(() => structuredClone(serialised)).not.toThrow()
  })

  it('detaches a live geometry view written into a canonical field in place', () => {
    const { node } = nodeInGraph()
    node.properties.savedSize = [0, 0]
    node.onSerialize = function (o) {
      o.properties!.savedSize = this.size
    }

    const serialised = node.serialize()

    expect(serialised.properties?.savedSize).toStrictEqual([...node.size])
    expect(() => structuredClone(serialised)).not.toThrow()
  })

  it('keeps the saved shape of a typed array detached alongside a proxy', () => {
    const { node } = nodeInGraph()
    node.onSerialize = function (o) {
      o.properties = { live: this.properties, typed: new Uint8Array([2, 3]) }
    }

    const serialised = node.serialize()

    expect(serialised.properties?.typed).toStrictEqual({ 0: 2, 1: 3 })
    expect(() => structuredClone(serialised)).not.toThrow()
  })

  it('keeps a canonical field that cannot be detached so saving fails', () => {
    const { node } = nodeInGraph()
    const cyclic = reactive<Record<string, unknown>>({})
    cyclic.self = cyclic
    node.onSerialize = (o) => {
      Reflect.set(o, 'properties', cyclic)
    }
    const warn = vi.mocked(console.warn)

    const serialised = node.serialize()

    expect(serialised.properties).toBe(cyclic)
    expect(() => JSON.stringify(serialised)).toThrow()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('keeps a canonical field whose in-place mutation throws so saving fails', () => {
    const { node } = nodeInGraph()
    node.onSerialize = (o) => {
      Object.defineProperty(o.properties!, 'broken', {
        enumerable: true,
        get(): never {
          throw new Error('accessor failed')
        }
      })
    }
    const warn = vi.mocked(console.warn)

    const serialised = node.serialize()

    expect(serialised.properties).toHaveProperty('elapsed', '00:01:000')
    expect(() => JSON.stringify(serialised)).toThrow('accessor failed')
    expect(warn).toHaveBeenCalledOnce()
  })

  it('keeps cloneable values a hook replaced intact', () => {
    const { node } = nodeInGraph()
    class PersistedValue {
      raw = 'ignored'

      toJSON() {
        return { saved: 'value' }
      }
    }
    node.onSerialize = (o) => {
      o.properties = { custom: new PersistedValue(), when: new Date(0) }
    }

    const serialised = node.serialize()

    expect(serialised.properties?.when).toStrictEqual(new Date(0))
    expect(JSON.parse(JSON.stringify(serialised)).properties.custom).toEqual({
      saved: 'value'
    })
  })

  it('serializes a reactive object widget value as plain data', () => {
    const { node } = nodeInGraph()
    node.serialize_widgets = true
    const widget = node.addWidget('text', 'box', '', null)
    widget.value = reactive({ x: 1, y: [2, 3] })

    const serialised = node.serialize()

    expect(serialised.widgets_values).toEqual([{ x: 1, y: [2, 3] }])
    expect(() => structuredClone(serialised)).not.toThrow()
  })
})
