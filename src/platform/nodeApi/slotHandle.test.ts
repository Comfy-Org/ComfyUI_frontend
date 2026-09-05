import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { GET_CONFIG } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'
import { toNodeId } from '@/types/nodeId'

import { ComfyApiError } from './errors'
import type { Resolver } from './resolution'
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

    it('writes the optional-slot shape into the saved workflow', () => {
      // Not decoration: shape is part of ISerialisableNodeInput, so an added
      // slot missing the one its pack used to set serialises differently from
      // one the pack itself wrote.
      inputs.add('trigger_words', 'STRING', { shape: 'optional' })
      inputs.add('plain', 'STRING')

      const saved = target.serialize().inputs!
      expect(saved.find((i) => i.name === 'trigger_words')?.shape).toBe(
        RenderShape.HollowCircle
      )
      expect(saved.find((i) => i.name === 'plain')?.shape).toBeUndefined()
      expect(inputs.byName('trigger_words')!.snapshot().shape).toBe('optional')
    })

    it('shapes a slot the pack introduces, and clears it again', () => {
      // rgthree's relay draws an arrow on the one output that may only ever
      // reach a repeater. 'optional' was the whole vocabulary, so that output
      // saved one field fewer than the same node saved before the migration —
      // the pack's own files bifurcated by creation date.
      const arrowed = outputs.add('REPEATER', '_NODE_REPEATER_', {
        shape: 'directional'
      })
      const listed = outputs.add('images', 'IMAGE', { shape: 'list' })

      const saved = () => source.serialize().outputs!
      expect(saved().find((o) => o.name === 'REPEATER')?.shape).toBe(
        RenderShape.ARROW
      )
      expect(saved().find((o) => o.name === 'images')?.shape).toBe(
        RenderShape.GRID
      )

      arrowed.modify({ shape: 'default' })
      expect(saved().find((o) => o.name === 'REPEATER')?.shape).toBeUndefined()

      listed.modify({ shape: 'optional' })
      expect(saved().find((o) => o.name === 'images')?.shape).toBe(
        RenderShape.HollowCircle
      )
    })

    it('marks a slot as the socket form of a widget, as the saved file records it', () => {
      // A slot carrying `widget` serialises as { widget: { name } }; a plain
      // socket serialises as { pos }. A dynamic input added without it changes
      // the saved file, which is why there is no partial version of this.
      target.addWidget('number', 'seed', 0, () => {})

      inputs.add('seed', 'INT', { widget: 'seed' })

      const saved = target.serialize().inputs!.find((i) => i.name === 'seed')!
      expect(saved.widget).toEqual({ name: 'seed' })
      expect(saved.pos).toBeUndefined()
    })

    it('updates a widget input definition without dropping its link', () => {
      const recreateWidget = vi.fn()
      const primitive = Object.assign(
        new LGraphNode('Primitive', 'PrimitiveNode'),
        { recreateWidget }
      )
      primitive.addOutput('value', 'IMAGE')
      graph.add(primitive)
      target.addWidget('number', 'image', 0, () => undefined, {})
      primitive.connect(0, target, 0)

      inputs.byName('image')!.modify({
        widget: 'image',
        widgetConfig: {
          type: 'INT',
          options: { min: 0, max: 100, step: 4 }
        }
      })

      expect(inputs.byName('image')!.isConnected).toBe(true)
      expect(recreateWidget).toHaveBeenCalledOnce()
      const getConfig = target.inputs[0].widget?.[GET_CONFIG] as
        | (() => unknown)
        | undefined
      expect(getConfig?.()).toEqual(['INT', { min: 0, max: 100, step: 4 }])

      inputs.byName('image')!.modify({ widget: 'image' })

      expect(target.inputs[0].widget?.[GET_CONFIG]).toBe(getConfig)
      expect(getConfig?.()).toEqual(['INT', { min: 0, max: 100, step: 4 }])
    })

    it('releases a connected Primitive when widget config is cleared', () => {
      const onLastDisconnect = vi.fn()
      const primitive = Object.assign(
        new LGraphNode('Primitive', 'PrimitiveNode'),
        { onLastDisconnect }
      )
      primitive.addOutput('value', 'IMAGE')
      graph.add(primitive)
      target.addWidget('number', 'image', 0, () => undefined, {})
      const input = inputs.byName('image')!
      input.modify({
        widget: 'image',
        widgetConfig: { type: 'INT', options: { min: 0, max: 10 } }
      })
      primitive.connect(0, target, input.index)

      input.modify({ widget: null })

      expect(input.isConnected).toBe(false)
      expect(onLastDisconnect).toHaveBeenCalledOnce()
    })

    it('adds a widget input with COMBO choices', () => {
      target.addWidget('combo', 'model', 'one', () => undefined, {
        values: ['one', 'two']
      })

      inputs.add('model', '*', {
        widget: 'model',
        widgetConfig: {
          type: ['one', 'two'],
          options: { default: 'one' }
        }
      })

      const getConfig = target.inputs[2].widget?.[GET_CONFIG] as
        | (() => unknown)
        | undefined
      expect(getConfig?.()).toEqual([['one', 'two'], { default: 'one' }])
    })

    it('lets a relay carry widget config without owning a widget', () => {
      const relay = inputs.add('value', '*', {
        widget: 'value',
        widgetConfig: {
          type: 'INT',
          options: { min: 0, max: 100, step: 2 }
        }
      })

      expect(relay.isWidgetInput).toBe(true)
      expect(relay.widgetConfig()).toEqual({
        type: 'INT',
        options: { min: 0, max: 100, step: 2 }
      })
    })

    it('merges compatible widget declarations and rejects incompatible ones', () => {
      target.addWidget('number', 'image', 0, () => undefined, {})
      const input = inputs.byName('image')!
      input.modify({
        widget: 'image',
        widgetConfig: {
          type: 'INT',
          options: { min: 0, max: 100, step: 2 }
        }
      })

      expect(
        input.mergeWidgetConfig({
          type: 'INT',
          options: { min: 10, max: 80, step: 4 }
        })
      ).toEqual({
        type: 'INT',
        options: { min: 10, max: 80, step: 4 }
      })
      expect(input.widgetConfig()).toEqual({
        type: 'INT',
        options: { min: 10, max: 80, step: 4 }
      })

      expect(
        input.mergeWidgetConfig({ type: 'FLOAT', options: { min: 0 } })
      ).toBeUndefined()
      expect(input.widgetConfig()?.type).toBe('INT')
    })

    it('replaces a previously merged widget declaration', () => {
      target.addWidget('number', 'image', 0, () => undefined, {})
      const input = inputs.byName('image')!
      input.modify({
        widget: 'image',
        widgetConfig: { type: 'INT', options: { min: 0, max: 100 } }
      })
      input.mergeWidgetConfig({
        type: 'INT',
        options: { min: 10, max: 80 }
      })

      input.modify({
        widgetConfig: { type: 'FLOAT', options: { min: -1, max: 1 } }
      })

      expect(input.widgetConfig()).toEqual({
        type: 'FLOAT',
        options: { min: -1, max: 1 }
      })
    })

    it('refuses to name a widget the node does not have', () => {
      // A misspelling would serialise as a widget input for a widget that is
      // not there — a saved file the loader cannot reconcile.
      expect(() => inputs.add('seed', 'INT', { widget: 'sed' })).toThrow(
        /No widget named 'sed'/
      )
      expect(inputs.byName('seed')).toBeUndefined()
    })

    it('reorders slots and takes every link with them', () => {
      // A link stores its endpoint as a slot INDEX. Permuting the array alone
      // silently re-points every connection, and the damage only shows the
      // next time the workflow runs.
      const a = new LGraphNode('A', 'TestNode')
      const b = new LGraphNode('B', 'TestNode')
      graph.add(a)
      graph.add(b)
      a.addOutput('out', 'IMAGE')
      b.addOutput('out', 'MASK')
      a.connect(0, target, 0) // -> 'image'
      b.connect(0, target, 1) // -> 'mask'

      expect(inputs.byName('image')?.isConnected).toBe(true)
      expect(inputs.byName('mask')?.isConnected).toBe(true)

      inputs.reorder(['mask', 'image'])

      expect(inputs.names()).toEqual(['mask', 'image'])
      // Each link still reaches the slot it was attached to, now at its new
      // index — not whatever slot happens to sit at the old one.
      expect(inputs.byName('image')?.source()?.nodeId).toBe(String(a.id))
      expect(inputs.byName('mask')?.source()?.nodeId).toBe(String(b.id))
    })

    it('refuses anything that is not a permutation', () => {
      expect(() => inputs.reorder(['image'])).toThrow(/permutation/)
      expect(() => inputs.reorder(['image', 'nope'])).toThrow(/permutation/)
      expect(inputs.names()).toEqual(['image', 'mask'])
    })

    it('rejects ambiguous duplicate names without changing the slots', () => {
      target.inputs[1].name = 'image'

      expect(() => inputs.reorder(['image', 'image'])).toThrow(/ambiguous/)

      expect(target.inputs).toHaveLength(2)
      expect(target.inputs[0]).not.toBe(target.inputs[1])
    })

    it('preserves slot order when endpoint updates are rejected', () => {
      const upstream = new LGraphNode('Upstream', 'TestNode')
      upstream.addOutput('out', 'IMAGE')
      graph.add(upstream)
      upstream.connect(0, target, 0)
      const before = [...target.inputs]
      vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
        ok: false,
        error: { code: 'occupied-target', message: 'occupied' }
      })

      expect(() => inputs.reorder(['mask', 'image'])).toThrow(
        /Could not re-point links/
      )

      expect(target.inputs).toEqual(before)
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

    it('reports the type arriving from a subgraph input panel', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'seed', type: 'INT' }]
      })
      const interior = new LGraphNode('Interior', 'InteriorNode')
      const input = interior.addInput('seed', '*')
      subgraph.add(interior)
      subgraph.inputNode.slots[0].connect(input, interior)
      const interiorInputs = createInputCollection(
        () => subgraph,
        () => subgraph.getNodeById(interior.id) ?? undefined
      )

      const handle = interiorInputs.byName('seed')!
      expect(handle.connectedType).toBe('INT')
    })

    it('resolves the source through frontend nodes without changing the graph', () => {
      const relay = new LGraphNode('Relay', 'TestRelay')
      relay.addInput('in', 'IMAGE')
      relay.addOutput('out', 'IMAGE')
      graph.add(relay)
      source.connect(0, relay, 0)
      relay.connect(0, target, 0)

      const resolvers = new Map<string, Resolver>([
        ['TestRelay', ({ self }) => ({ out: { forwardTo: self.input('in')! } })]
      ])
      const resolvedInputs = createInputCollection(
        () => graph,
        () => graph.getNodeById(target.id) ?? undefined,
        () => resolvers
      )
      const before = graph.serialize()

      expect(resolvedInputs.byName('image')!.resolvedSource()).toEqual({
        kind: 'output',
        graphId: graph.id,
        nodeId: String(source.id),
        outputIndex: 0
      })
      expect(graph.serialize()).toEqual(before)
    })

    it('reports a literal supplied by a frontend node', () => {
      const relay = new LGraphNode('Relay', 'LiteralRelay')
      relay.addOutput('out', 'IMAGE')
      graph.add(relay)
      relay.connect(0, target, 0)

      const resolvers = new Map<string, Resolver>([
        ['LiteralRelay', () => ({ out: { literal: 7 } })]
      ])
      const resolvedInputs = createInputCollection(
        () => graph,
        () => graph.getNodeById(target.id) ?? undefined,
        () => resolvers
      )

      expect(resolvedInputs.byName('image')!.resolvedSource()).toEqual({
        kind: 'literal',
        value: 7
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

    it('preserves output links when the target does not exist', () => {
      outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')

      expect(() => outputs.byName('IMAGE')!.disconnect('missing')).toThrow(
        ComfyApiError
      )
      expect(inputs.byName('image')!.isConnected).toBe(true)
    })

    it('disconnects only the named target', () => {
      const other = new LGraphNode('Other', 'TargetNode')
      other.addInput('image', 'IMAGE')
      graph.add(other)
      outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')
      outputs.byName('IMAGE')!.connectTo(String(other.id), 'image')

      expect(outputs.byName('IMAGE')!.disconnect(String(target.id))).toBe(true)

      expect(inputs.byName('image')!.isConnected).toBe(false)
      expect(other.isInputConnected(0)).toBe(true)
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
          const node = graph.getNodeById(toNodeId(link.targetNodeId))
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

    it('writes localized names, positions and link directions', () => {
      const input = inputs.byName('image')!
      input.modify({
        localizedName: '',
        position: { x: 12, y: 34 },
        direction: 'up'
      })

      expect(input.snapshot()).toMatchObject({
        localizedName: '',
        position: { x: 12, y: 34 },
        direction: 'up'
      })
      expect(target.serialize().inputs?.[0]).toMatchObject({
        localized_name: '',
        pos: [12, 34],
        dir: 1
      })

      input.modify({
        localizedName: null,
        position: null,
        direction: null
      })
      expect(input.snapshot()).toMatchObject({
        localizedName: undefined,
        position: undefined,
        direction: undefined
      })
    })

    it('retargets a widget input without accepting a missing widget', () => {
      target.addWidget('number', 'seed', 0, () => {})
      target.addWidget('number', 'next_seed', 0, () => {})
      const input = inputs.add('seed', 'INT', { widget: 'seed' })

      expect(() =>
        input.modify({ name: 'missing', widget: 'missing' })
      ).toThrow(/No widget named 'missing'/)
      expect(input.name).toBe('seed')

      input.modify({ name: 'next_seed', widget: 'next_seed' })

      const saved = target
        .serialize()
        .inputs!.find((slot) => slot.name === 'next_seed')!
      expect(saved.widget).toEqual({ name: 'next_seed' })
      expect(input.isWidgetInput).toBe(true)

      input.modify({ widget: null })

      expect(input.isWidgetInput).toBe(false)
      expect(
        target.serialize().inputs!.find((slot) => slot.name === 'next_seed')!
          .widget
      ).toBeUndefined()
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

    it('retypes existing links with their output', () => {
      const link = outputs
        .byName('IMAGE')!
        .connectTo(String(target.id), 'image')!

      outputs.at(0)!.modify({ type: 'LATENT' })

      expect(outputs.at(0)!.links()).toContainEqual({
        ...link,
        type: 'LATENT'
      })
      expect(graph.serialize().links).toContainEqual([
        Number(link.id),
        Number(link.sourceNodeId),
        link.sourceIndex,
        Number(link.targetNodeId),
        link.targetIndex,
        'LATENT'
      ])
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
