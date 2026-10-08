import { describe, expect, it } from 'vitest'

import { LGraphNode, NodeInputSlot } from '@/lib/litegraph/src/litegraph'
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
