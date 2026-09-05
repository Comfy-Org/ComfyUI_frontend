import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode, NodeInputSlot } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

/**
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/15924#discussion_r3858723898
 *
 * `extensionConfigureView` used to `Object.assign` the extensions-namespaced
 * payload directly onto the caller's serialized node object and hand that
 * same live object to `onConfigure`. An extension mutating its argument, or
 * simply the namespaced payload being promoted onto it, polluted the
 * caller's workflow JSON in place.
 */
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

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('LGraphNode.configure onConfigure hook isolation', () => {
  it('hands onConfigure a clone, not the caller live serialized object', () => {
    const node = new LGraphNode('TestNode')
    const canonical = nodeWithNamespacedExtension()
    const canonicalSnapshot = JSON.parse(JSON.stringify(canonical))

    let hookArg: unknown
    node.onConfigure = (data) => {
      hookArg = data
      Object.assign(data, { mutated: true })
    }

    node.configure(canonical)

    expect(hookArg).not.toBe(canonical)
    expect(canonical).toEqual(canonicalSnapshot)
  })

  it('does not promote namespaced extension keys onto the caller serialized object', () => {
    const node = new LGraphNode('TestNode')
    // The configure view is only built when a hook is installed.
    node.onConfigure = () => {}
    const info = nodeWithNamespacedExtension()

    node.configure(info)

    expect(info).not.toHaveProperty('myExt')
    expect(info.extensions).toEqual({ myExt: { note: 'hello' } })

    const serialized = node.serialize()
    expect(serialized).not.toHaveProperty('myExt')
    expect(serialized.extensions).toEqual({ myExt: { note: 'hello' } })
  })

  it('accepts a serialized object that still holds live slot instances', () => {
    // `ComfyNode.configure` (litegraphService) fills `data.inputs` with the
    // node's live `NodeInputSlot` instances before calling
    // `LGraphNode.configure`. Those carry a node back-reference and only
    // become plain data through `toJSON()`, so the view must not
    // `structuredClone` them (DataCloneError) and must hand the hook the JSON
    // shape.
    const node = new LGraphNode('TestNode')
    node.addInput('in', 'number')
    const info: ISerialisedNode = {
      ...nodeWithNamespacedExtension(),
      inputs: [new NodeInputSlot({ name: 'in', type: 'number' }, node)]
    }

    let hookArg: ISerialisedNode | undefined
    node.onConfigure = (data) => {
      hookArg = data
    }

    expect(() => node.configure(info)).not.toThrow()
    expect(hookArg?.inputs?.[0]).toEqual(
      JSON.parse(JSON.stringify(info.inputs?.[0]))
    )
    expect(hookArg?.inputs?.[0]).not.toBe(info.inputs?.[0])
  })

  it('keeps a missing-node placeholder free of promoted keys after onConfigure mutates its view', () => {
    const node = new LGraphNode('TestNode')
    node.onConfigure = (data) => {
      Object.assign(data, { mutated: true })
    }
    const info = nodeWithNamespacedExtension()

    node.configure(info)
    // Missing-node placeholders retain the caller's object as their
    // last-serialization fallback (see `LGraph.ts`'s `last_serialization =
    // n_info` assignments).
    node.last_serialization = info

    const reserialized = node.serialize()

    expect(reserialized).not.toHaveProperty('myExt')
    expect(reserialized).not.toHaveProperty('mutated')
  })
})
