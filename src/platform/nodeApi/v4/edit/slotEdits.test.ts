import { LinkDirection, RenderShape } from '@comfyorg/graph-model/globalEnums'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

describe('slot edits', () => {
  let graph: LGraph
  let comfy: Comfy
  let host: ComfyApiHost
  let steps: string[]
  let source: LGraphNode
  let target: LGraphNode
  let sourceHandle: NodeHandle
  let targetHandle: NodeHandle

  beforeEach(() => {
    graph = new LGraph()
    steps = []
    ;({ comfy, host } = createComfyApi({
      getGraph: () => graph,
      history: () => ({
        beforeChange: () => steps.push('before'),
        afterChange: () => steps.push('after')
      })
    }))
    source = new LGraphNode('Source')
    source.addOutput('a', 'INT')
    source.addOutput('b', 'FLOAT')
    source.addOutput('c', 'STRING')
    target = new LGraphNode('Target')
    target.addInput('x', 'INT')
    target.addInput('y', 'FLOAT')
    target.addInput('z', 'STRING')
    graph.add(source)
    graph.add(target)
    const sourceFound = comfy.graph.node(String(source.id))
    const targetFound = comfy.graph.node(String(target.id))
    assert(sourceFound && targetFound)
    sourceHandle = sourceFound
    targetHandle = targetFound
  })

  function input(name: string) {
    const slot = targetHandle.inputs.byName(name)
    assert(slot)
    return slot
  }

  function output(name: string) {
    const slot = sourceHandle.outputs.byName(name)
    assert(slot)
    return slot
  }

  describe('updateSlot', () => {
    it('changes every field of a patch as one undo step, advancing the version', () => {
      const version = graph._version
      const slot = target.inputs[0]

      const applied = input('x').modify({
        name: 'renamed',
        label: 'Shown',
        localizedName: 'Übersetzt',
        type: ['INT', 'FLOAT'],
        color: '#1',
        colorWhenUnconnected: '#2',
        shape: 'list',
        position: { x: 5, y: 6 },
        direction: 'down'
      })

      expect(applied).toBe(true)
      expect(slot).toMatchObject({
        name: 'renamed',
        label: 'Shown',
        localized_name: 'Übersetzt',
        type: 'INT,FLOAT',
        color_on: '#1',
        color_off: '#2',
        shape: RenderShape.GRID,
        pos: [5, 6],
        dir: LinkDirection.DOWN
      })
      expect(steps).toEqual(['before', 'after'])
      expect(graph._version).toBeGreaterThan(version)
    })

    it('clears the fields that have a default with null or undefined', () => {
      const slot = target.inputs[0]
      Object.assign(slot, {
        label: 'L',
        localized_name: 'N',
        color_on: '#1',
        color_off: '#2',
        shape: RenderShape.ARROW,
        pos: [1, 1],
        dir: LinkDirection.UP
      })

      input('x').modify({
        label: null,
        localizedName: undefined,
        color: null,
        colorWhenUnconnected: undefined,
        shape: 'default',
        position: null,
        direction: undefined
      })

      expect(slot).toMatchObject({
        label: undefined,
        localized_name: undefined,
        color_on: undefined,
        color_off: undefined,
        shape: undefined,
        pos: undefined,
        dir: undefined
      })
    })

    it('retypes an output and the links leaving it', () => {
      const link = source.connect(0, target, 0)

      output('a').modify({ type: 'NUMBER' })

      expect(source.outputs[0].type).toBe('NUMBER')
      expect(link?.type).toBe('NUMBER')
    })

    it('retypes an input and keeps its link', () => {
      source.connect(0, target, 0)

      input('x').modify({ type: 'NUMBER' })

      expect(target.inputs[0].type).toBe('NUMBER')
      expect(input('x').isConnected).toBe(true)
    })

    it('makes an input the socket form of one of the node’s widgets', () => {
      target.addWidget('number', 'steps', 1, () => {})

      input('x').modify({ widget: 'steps' })

      expect(target.inputs[0].widget).toEqual({ name: 'steps' })
      expect(input('x').isWidgetInput).toBe(true)
    })

    it('lets a slot keep its own name', () => {
      expect(input('x').modify({ name: 'x' })).toBe(true)
    })

    const unusable: [string, 'input' | 'output', unknown][] = [
      ['a patch that is not an object', 'input', 'x'],
      ['a field slots do not have', 'input', { tooltip: 'x' }],
      ['a widget on an output', 'output', { widget: 'steps' }],
      ['an empty name', 'input', { name: '' }],
      ['a name that is not text', 'input', { name: 3 }],
      ['a label that is not text', 'input', { label: 3 }],
      ['an empty type', 'input', { type: '' }],
      ['an empty list of types', 'input', { type: [] }],
      ['a list with a type that is not text', 'output', { type: ['INT', 1] }],
      ['an unknown shape', 'input', { shape: 'star' }],
      ['an unknown direction', 'input', { direction: 'sideways' }],
      ['a NaN position', 'input', { position: { x: Number.NaN, y: 0 } }],
      ['a color that is not text', 'output', { color: 1 }],
      ['a widget name that is not text', 'input', { widget: 1 }],
      ['a name another input has', 'input', { name: 'y' }],
      ['a name another output has', 'output', { name: 'b' }],
      ['a widget the node does not have', 'input', { widget: 'missing' }]
    ]

    it.for(unusable)(
      'refuses %s before changing anything',
      ([, side, patch]) => {
        source.addWidget('number', 'steps', 1, () => {})
        const slot = side === 'input' ? input('x') : output('a')
        const before = JSON.stringify(
          side === 'input' ? target.inputs : source.outputs
        )
        const version = graph._version

        expect(() =>
          Reflect.apply(slot.modify, undefined, [{ label: 'Changed' }])
        ).not.toThrow()
        const afterControl = JSON.stringify(
          side === 'input' ? target.inputs : source.outputs
        )
        const controlVersion = graph._version

        expect(() => Reflect.apply(slot.modify, undefined, [patch])).toThrow(
          TypeError
        )
        expect(afterControl).not.toBe(before)
        expect(
          JSON.stringify(side === 'input' ? target.inputs : source.outputs)
        ).toBe(afterControl)
        expect(graph._version).toBe(controlVersion)
        expect(controlVersion).toBeGreaterThan(version)
      }
    )

    it('changes nothing for a slot that is gone, and still refuses an unusable patch', () => {
      const slot = input('z')
      target.removeInput(2)

      expect(slot.modify({ label: 'x' })).toBe(false)
      expect(() =>
        Reflect.apply(slot.modify, undefined, [{ label: 1 }])
      ).toThrow(TypeError)
      expect(steps).toEqual([])
    })

    it.for([
      ['nothing', undefined],
      ['a node handle', 'node'],
      ['a slot name', 'x']
    ])('refuses %s in place of a slot handle', ([, given]) => {
      const slot = given === 'node' ? targetHandle : given

      expect(() =>
        Reflect.apply(comfy.edit.updateSlot, undefined, [slot, { label: 'x' }])
      ).toThrow('updateSlot needs a slot handle')
    })
  })

  describe('addInput and addOutput', () => {
    it('add a slot after the others, as one undo step, and give its handle', () => {
      const version = graph._version

      const added = targetHandle.inputs.add('w', 'LATENT', {
        shape: 'optional'
      })
      const out = sourceHandle.outputs.add('d', ['A', 'B'])

      expect(added).toBe(targetHandle.inputs.at(3))
      expect(added?.name).toBe('w')
      expect(target.inputs[3].shape).toBe(RenderShape.HollowCircle)
      expect(out?.type).toBe('A,B')
      expect(source.outputs).toHaveLength(4)
      expect(steps).toEqual(['before', 'after', 'before', 'after'])
      expect(graph._version).toBeGreaterThan(version)
    })

    it('add an input that is the socket form of a widget', () => {
      target.addWidget('number', 'steps', 1, () => {})

      const added = comfy.edit.addInput(targetHandle, 'steps', 'INT', {
        widget: 'steps'
      })

      expect(added?.isWidgetInput).toBe(true)
      expect(target.inputs[3].widget).toEqual({ name: 'steps' })
    })

    it.for([
      ['an empty name', 'input', ['', 'INT']],
      ['a name the side already has', 'input', ['x', 'INT']],
      ['a type that is not text', 'output', ['d', 5]],
      ['options that are not an object', 'input', ['w', 'INT', 'optional']],
      ['an unknown option', 'input', ['w', 'INT', { label: 'W' }]],
      ['a widget on an output', 'output', ['d', 'INT', { widget: 'x' }]],
      [
        'a widget the node does not have',
        'input',
        ['w', 'INT', { widget: 'nope' }]
      ],
      ['an unknown shape', 'output', ['d', 'INT', { shape: 'hex' }]]
    ] as const)('refuse %s before adding anything', ([, side, args]) => {
      const collection =
        side === 'input' ? targetHandle.inputs : sourceHandle.outputs
      const length = collection.length

      expect(() => Reflect.apply(collection.add, undefined, [...args])).toThrow(
        TypeError
      )
      expect(collection.length).toBe(length)
      expect(steps).toEqual([])
    })

    it('add nothing to a node that is gone', () => {
      graph.remove(target)

      expect(targetHandle.inputs.add('w', 'INT')).toBeUndefined()
      expect(comfy.edit.addOutput(targetHandle, 'o', 'INT')).toBeUndefined()
    })
  })

  describe('removeSlot', () => {
    it('removes a slot and its link as one undo step', () => {
      source.connect(0, target, 0)
      const version = graph._version

      expect(targetHandle.inputs.remove('x')).toBe(true)

      expect(target.inputs.map(({ name }) => name)).toEqual(['y', 'z'])
      expect(sourceHandle.outputs.at(0)?.isConnected).toBe(false)
      expect(steps).toEqual(['before', 'after'])
      expect(graph._version).toBeGreaterThan(version)
    })

    it('removes an output by position or by id', () => {
      const last = output('c')

      expect(sourceHandle.outputs.remove({ index: 0 })).toBe(true)
      expect(sourceHandle.outputs.remove(last.id)).toBe(true)

      expect(source.outputs.map(({ name }) => name)).toEqual(['b'])
    })

    it('says no for a slot that is not there', () => {
      expect(targetHandle.inputs.remove('missing')).toBe(false)
      expect(targetHandle.inputs.remove({ index: 9 })).toBe(false)
      expect(steps).toEqual([])
    })

    it('says no for a slot that is gone', () => {
      const slot = input('z')
      target.removeInput(2)

      expect(comfy.edit.removeSlot(slot)).toBe(false)
    })

    it.for([[3], [{ index: -1 }], [{ index: 1.5 }], [{}], [null]])(
      'refuses a reference that is not an id, name or position: %o',
      ([ref]) => {
        expect(() =>
          Reflect.apply(targetHandle.inputs.remove, undefined, [ref])
        ).toThrow(TypeError)
        graph.remove(target)
        expect(() =>
          Reflect.apply(targetHandle.inputs.remove, undefined, [ref])
        ).toThrow(TypeError)
      }
    )

    it('refuses a name two slots share', () => {
      source.addOutput('a', 'INT')

      expect(() => sourceHandle.outputs.remove('a')).toThrow(TypeError)
      expect(source.outputs).toHaveLength(4)
    })
  })

  describe('reorderSlots', () => {
    it('reorders inputs with their links, keeping link ids, as one undo step', () => {
      const intoX = source.connect(0, target, 0)
      const intoZ = source.connect(2, target, 2)
      const version = graph._version

      expect(targetHandle.inputs.reorder(['z', 'x', 'y'])).toBe(true)

      expect(target.inputs.map(({ name }) => name)).toEqual(['z', 'x', 'y'])
      expect(input('z').link()?.id).toBe(String(intoZ?.id))
      expect(input('x').link()?.id).toBe(String(intoX?.id))
      expect(input('z').link()?.targetIndex).toBe(0)
      expect(input('y').isConnected).toBe(false)
      expect(steps).toEqual(['before', 'after'])
      expect(graph._version).toBeGreaterThan(version)
    })

    it('reorders outputs with their links, keeping link ids', () => {
      const fromA = source.connect(0, target, 0)
      const fromC = source.connect(2, target, 2)

      expect(sourceHandle.outputs.reorder(['c', 'b', 'a'])).toBe(true)

      expect(source.outputs.map(({ name }) => name)).toEqual(['c', 'b', 'a'])
      expect(
        output('c')
          .links()
          ?.map(({ id, sourceIndex }) => [id, sourceIndex])
      ).toEqual([[String(fromC?.id), 0]])
      expect(
        output('a')
          .links()
          ?.map(({ id, sourceIndex }) => [id, sourceIndex])
      ).toEqual([[String(fromA?.id), 2]])
      expect(input('x').source()).toEqual({
        nodeId: String(source.id),
        outputIndex: 2
      })
    })

    it.for([
      ['a list that leaves a slot out', 'input', ['x', 'y']],
      ['a list with a slot twice', 'input', ['x', 'x', 'y']],
      ['a list with a name no slot has', 'output', ['a', 'b', 'q']],
      ['something that is not a list', 'output', 'a,b,c'],
      ['a list with something that is not a name', 'input', ['x', 'y', 3]],
      ['a side that is neither', 'inputs', ['x', 'y', 'z']]
    ] as const)('refuses %s before moving anything', ([, side, names]) => {
      const before = [
        target.inputs.map(({ name }) => name),
        source.outputs.map(({ name }) => name)
      ]
      const node = side === 'output' ? sourceHandle : targetHandle

      expect(() =>
        Reflect.apply(comfy.edit.reorderSlots, undefined, [node, side, names])
      ).toThrow(TypeError)
      expect([
        target.inputs.map(({ name }) => name),
        source.outputs.map(({ name }) => name)
      ]).toEqual(before)
      expect(steps).toEqual([])
    })

    it('refuses to reorder slots two of which share a name', () => {
      source.addOutput('a', 'INT')

      expect(() => sourceHandle.outputs.reorder(['a', 'b', 'c', 'a'])).toThrow(
        TypeError
      )
    })

    it.for(['input', 'output'] as const)(
      'says no and moves nothing when the link store refuses the %s links',
      (side) => {
        source.connect(0, target, 0)
        vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
          ok: false,
          error: { code: 'occupied-target', message: 'refused' }
        })
        const before = [
          target.inputs.map(({ name }) => name),
          source.outputs.map(({ name }) => name)
        ]

        const names = side === 'input' ? ['z', 'y', 'x'] : ['c', 'b', 'a']
        const node = side === 'input' ? targetHandle : sourceHandle
        expect(comfy.edit.reorderSlots(node, side, names)).toBe(false)

        expect([
          target.inputs.map(({ name }) => name),
          source.outputs.map(({ name }) => name)
        ]).toEqual(before)
      }
    )

    it('moves nothing on a node that is gone', () => {
      graph.remove(target)

      expect(targetHandle.inputs.reorder(['z', 'y', 'x'])).toBe(false)
    })

    it('reorders nothing for a node of a document that is no longer open', () => {
      host.beginDocument()

      expect(targetHandle.inputs.reorder(['z', 'y', 'x'])).toBe(false)
      expect(target.inputs.map(({ name }) => name)).toEqual(['x', 'y', 'z'])
    })
  })
})
