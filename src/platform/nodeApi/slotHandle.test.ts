import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { ComfyApiError } from './errors'
import { createInputCollection, createOutputCollection } from './slotHandle'
import type {
  InputSlotHandle,
  OutputSlotHandle,
  SlotCollection
} from './slotHandle'

describe('slot handles', () => {
  let graph: LGraph
  let source: LGraphNode
  let target: LGraphNode
  let outputs: SlotCollection<OutputSlotHandle>
  let inputs: SlotCollection<InputSlotHandle>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()

    source = new LGraphNode('Source', 'SourceNode')
    source.addOutput('IMAGE', 'IMAGE')
    source.addOutput('MASK', 'MASK')
    graph.add(source)

    target = new LGraphNode('Target', 'TargetNode')
    target.addInput('image', 'IMAGE')
    target.addInput('mask', 'MASK')
    graph.add(target)

    outputs = createOutputCollection(
      () => graph,
      () => graph.getNodeById(source.id) ?? undefined
    )
    inputs = createInputCollection(
      () => graph,
      () => graph.getNodeById(target.id) ?? undefined
    )
  })

  describe('collections', () => {
    it('reports length, names and ids', () => {
      expect(outputs.length).toBe(2)
      expect(inputs.names()).toEqual(['image', 'mask'])
      expect(new Set(inputs.ids()).size).toBe(2)
    })

    it('takes a union type and connects from a member of it', () => {
      // rgthree ships `addInput('input', ['IMAGE','LATENT','MASK'])`. litegraph
      // compares types with `String(type).split(',')`, so the array and the
      // comma string are the same slot to every connection check.
      const union = inputs.add('either', ['IMAGE', 'LATENT', 'MASK'])

      expect(union.type).toBe('IMAGE,LATENT,MASK')
      expect(source.connect(0, target, union.index)).toBeTruthy()
      expect(inputs.byName('either')?.isConnected).toBe(true)
    })

    it('looks up by name, id and explicit index', () => {
      expect(inputs.byName('mask')?.index).toBe(1)
      expect(inputs.at(0)?.name).toBe('image')
      const id = inputs.at(1)!.id
      expect(inputs.byId(id)?.name).toBe('mask')
      expect(inputs.get({ index: 0 })?.name).toBe('image')
    })

    it("resolves '0' positionally while names are unavailable", () => {
      expect(inputs.get('0')?.name).toBe('image')
    })

    it('is iterable', () => {
      expect([...inputs].map((s) => s.name)).toEqual(['image', 'mask'])
    })

    it('returns undefined rather than throwing for a bad ref', () => {
      expect(inputs.get('nope')).toBeUndefined()
      expect(inputs.at(99)).toBeUndefined()
    })
  })

  describe('slot identity survives reordering', () => {
    it('keeps the id stable when a slot is inserted before it', () => {
      const mask = inputs.byName('mask')!
      const id = mask.id
      expect(mask.index).toBe(1)

      target.addInput('extra', 'INT')
      const reordered = [target.inputs[2], target.inputs[0], target.inputs[1]]
      target.inputs.splice(0, target.inputs.length, ...reordered)

      expect(inputs.byId(id)!.name).toBe('mask')
      expect(inputs.byId(id)!.index).toBe(2)
    })
  })

  describe('connectivity', () => {
    it('connects by name and reports both endpoints', () => {
      const link = outputs
        .byName('IMAGE')!
        .connectTo(String(target.id), 'image')

      expect(link).toBeDefined()
      expect(link!.sourceNodeId).toBe(String(source.id))
      expect(link!.targetNodeId).toBe(String(target.id))
      expect(link!.sourceIndex).toBe(0)
      expect(link!.targetIndex).toBe(0)
      expect(inputs.byName('image')!.isConnected).toBe(true)
      expect(outputs.byName('IMAGE')!.isConnected).toBe(true)
    })

    it('connects by explicit index', () => {
      outputs.at(1)!.connectTo(String(target.id), { index: 1 })
      expect(inputs.byName('mask')!.isConnected).toBe(true)
    })

    it('reports the source of a connected input', () => {
      outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')
      expect(inputs.byName('image')!.source()).toEqual({
        nodeId: String(source.id),
        outputIndex: 0
      })
    })

    it('returns an inert LinkInfo, not a live LLink', () => {
      const link = outputs
        .byName('IMAGE')!
        .connectTo(String(target.id), 'image')!
      expect(Object.isFrozen(link)).toBe(true)
      expect(() => structuredClone(link)).not.toThrow()
    })

    it('throws a clear error for an unknown target node', () => {
      expect(() => outputs.at(0)!.connectTo('does-not-exist', 'image')).toThrow(
        ComfyApiError
      )
    })

    it('throws a clear error for an unknown input ref', () => {
      expect(() => outputs.at(0)!.connectTo(String(target.id), 'nope')).toThrow(
        /No input matching 'nope'/
      )
    })

    it('disconnects an input', () => {
      outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')
      expect(inputs.byName('image')!.disconnect()).toBe(true)
      expect(inputs.byName('image')!.isConnected).toBe(false)
    })

    it('disconnects an output', () => {
      outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')
      expect(outputs.byName('IMAGE')!.disconnect()).toBe(true)
      expect(inputs.byName('image')!.isConnected).toBe(false)
    })
  })

  describe('links() returns a safe snapshot', () => {
    it('is frozen', () => {
      outputs.at(0)!.connectTo(String(target.id), 'image')
      expect(Object.isFrozen(outputs.at(0)!.links())).toBe(true)
    })

    it('allows disconnecting while iterating', () => {
      const second = new LGraphNode('Second', 'TargetNode')
      second.addInput('image', 'IMAGE')
      graph.add(second)

      outputs.at(0)!.connectTo(String(target.id), 'image')
      outputs.at(0)!.connectTo(String(second.id), 'image')
      expect(outputs.at(0)!.links()).toHaveLength(2)

      // The old mutable `output.links` mirror made exactly this unsafe.
      expect(() => {
        for (const link of outputs.at(0)!.links()) {
          const node = graph.getNodeById(link.targetNodeId as unknown as never)
          node?.disconnectInput(link.targetIndex)
        }
      }).not.toThrow()
      expect(outputs.at(0)!.links()).toHaveLength(0)
    })
  })

  describe('modify — retype and rename', () => {
    it('renames and relabels atomically', () => {
      inputs.byName('image')!.modify({ name: 'picture', label: 'Picture' })
      expect(inputs.at(0)!.name).toBe('picture')
      expect(inputs.at(0)!.label).toBe('Picture')
    })

    it('retypes a slot', () => {
      outputs.at(0)!.modify({ type: 'LATENT' })
      expect(outputs.at(0)!.type).toBe('LATENT')
    })

    it('keeps existing links when retyping', () => {
      // SetNode-style dynamic typing (* -> MODEL) depends on this.
      outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')
      outputs.at(0)!.modify({ type: 'LATENT' })
      expect(inputs.byName('image')!.isConnected).toBe(true)
    })

    it('leaves unspecified fields alone', () => {
      outputs.at(0)!.modify({ type: 'LATENT' })
      expect(outputs.at(0)!.name).toBe('IMAGE')
    })
  })

  describe('moveLinksTo preserves link identity', () => {
    it('moves links and keeps their ids', () => {
      const created = outputs
        .byName('IMAGE')!
        .connectTo(String(target.id), 'image')!
      const originalId = created.id

      const moved = outputs.byName('IMAGE')!.moveLinksTo({ index: 1 })

      expect(moved).toHaveLength(1)
      expect(moved[0].id).toBe(originalId)
      expect(moved[0].sourceIndex).toBe(1)
      expect(outputs.at(0)!.isConnected).toBe(false)
      expect(outputs.at(1)!.isConnected).toBe(true)
      // Target endpoint is untouched.
      expect(inputs.byName('image')!.isConnected).toBe(true)
    })

    it('is not the same as disconnect-and-reconnect', () => {
      const created = outputs
        .byName('IMAGE')!
        .connectTo(String(target.id), 'image')!
      outputs.at(0)!.disconnect()
      const recreated = outputs.at(0)!.connectTo(String(target.id), 'image')!
      // Reconnecting allocates a new id — which is why moveLinksTo exists.
      expect(recreated.id).not.toBe(created.id)
    })

    it('does not re-validate slot types, by design', () => {
      // rgthree moves links off an output and *then* retypes it, so enforcing
      // type compatibility mid-move would reject the real-world sequence.
      outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')
      expect(() => outputs.byName('IMAGE')!.moveLinksTo('MASK')).not.toThrow()
      expect(outputs.byName('MASK')!.isConnected).toBe(true)
    })

    it('moves several links at once', () => {
      const second = new LGraphNode('Second', 'TargetNode')
      second.addInput('image', 'IMAGE')
      graph.add(second)

      outputs.at(0)!.connectTo(String(target.id), 'image')
      outputs.at(0)!.connectTo(String(second.id), 'image')
      const ids = outputs
        .at(0)!
        .links()
        .map((l) => l.id)

      const moved = outputs.at(0)!.moveLinksTo({ index: 1 })
      expect(moved.map((l) => l.id).sort()).toEqual(ids.sort())
    })

    it('is a no-op for an unconnected output', () => {
      expect(outputs.at(0)!.moveLinksTo({ index: 1 })).toEqual([])
    })

    it('returns current links when moving onto itself', () => {
      outputs.at(0)!.connectTo(String(target.id), 'image')
      expect(outputs.at(0)!.moveLinksTo({ index: 0 })).toHaveLength(1)
    })

    it('throws for an unknown target slot', () => {
      expect(() => outputs.at(0)!.moveLinksTo('nope')).toThrow(ComfyApiError)
    })
  })

  describe('snapshots', () => {
    it('replaces {...input} with usable plain data', () => {
      const snap = inputs.byName('image')!.snapshot()
      expect(snap).toMatchObject({
        name: 'image',
        type: 'IMAGE',
        index: 0,
        isConnected: false
      })
      expect(Object.isFrozen(snap)).toBe(true)
      expect(() => structuredClone(snap)).not.toThrow()
    })
  })

  describe('when the node is deleted', () => {
    it('empties the collection and degrades handles safely', () => {
      const held = inputs.byName('image')!
      graph.remove(target)

      expect(inputs.length).toBe(0)
      expect(held.index).toBe(-1)
      expect(held.name).toBe('')
      expect(held.isConnected).toBe(false)
      expect(held.link()).toBeUndefined()
      expect(() => held.disconnect()).not.toThrow()
      expect(held.snapshot().index).toBe(-1)
    })
  })
})

describe('dynamic slots', () => {
  let graph: LGraph
  let node: LGraphNode
  let inputs: SlotCollection<InputSlotHandle>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = new LGraphNode('t')
    node.addInput('image_1', 'IMAGE')
    graph.add(node)
    inputs = createInputCollection(
      () => graph,
      () => graph.getNodeById(node.id) ?? undefined
    )
  })

  it('adds a slot and hands back a handle to it', () => {
    // The "Multi" combiner pattern: grow inputs as the last one fills.
    const added = inputs.add('image_2', 'IMAGE')
    expect(added.name).toBe('image_2')
    expect(inputs.names()).toEqual(['image_1', 'image_2'])
  })

  it('removes a slot by name', () => {
    inputs.add('image_2', 'IMAGE')
    expect(inputs.remove('image_1')).toBe(true)
    expect(inputs.names()).toEqual(['image_2'])
  })

  it('reports false rather than throwing for a slot that is not there', () => {
    expect(inputs.remove('nope')).toBe(false)
  })
})
