import { LinkDirection, RenderShape } from '@comfyorg/graph-model/globalEnums'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphNode,
  NodeOutputSlot
} from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { EditCore } from '@/platform/nodeApi/v4/edit/edits'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

describe('slot edits', () => {
  let graph: LGraph
  let comfy: Comfy
  let edit: EditCore
  let host: ComfyApiHost
  let steps: string[]
  let source: LGraphNode
  let target: LGraphNode
  let sourceHandle: NodeHandle
  let targetHandle: NodeHandle

  beforeEach(() => {
    graph = new LGraph()
    steps = []
    ;({ comfy, host, edit } = createComfyApi({
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

    it('gives a slot an empty name and an empty translated name, which the host saves and draws as no text', () => {
      expect(output('a').modify({ name: '', localizedName: '' })).toBe(true)

      const [renamed] = source.outputs
      assert(renamed instanceof NodeOutputSlot)
      expect(renamed.name).toBe('')
      expect(renamed.localized_name).toBe('')
      expect(renamed.renderingLabel).toBe('')
      expect(source.serialize().outputs?.[0]).toMatchObject({
        name: '',
        localized_name: ''
      })
    })

    it('lets several slots on one side be named empty, and finds none of them by that name', () => {
      const first = output('a')
      const second = output('b')

      expect(first.modify({ name: '' })).toBe(true)
      expect(second.modify({ name: '' })).toBe(true)

      expect(source.outputs.map(({ name }) => name)).toEqual(['', '', 'c'])
      expect(sourceHandle.outputs.byName('')).toBeUndefined()
      expect(sourceHandle.outputs.at(1)).toBe(second)
      expect(() => second.modify({ name: 'c' })).toThrow(
        /^modify needs a name no other slot on this side has/
      )
    })

    const anInput = { slot: () => input('x'), saved: () => target.inputs }
    const anOutput = { slot: () => output('a'), saved: () => source.outputs }

    it.for<{
      name: string
      on: typeof anInput | typeof anOutput
      patch: unknown
    }>([
      { name: 'a patch that is not an object', on: anInput, patch: 'x' },
      {
        name: 'a field slots do not have',
        on: anInput,
        patch: { tooltip: 'x' }
      },
      {
        name: 'a widget on an output',
        on: anOutput,
        patch: { widget: 'steps' }
      },
      { name: 'a name that is not text', on: anInput, patch: { name: 3 } },
      { name: 'a label that is not text', on: anInput, patch: { label: 3 } },
      { name: 'an empty type', on: anInput, patch: { type: '' } },
      { name: 'an empty list of types', on: anInput, patch: { type: [] } },
      {
        name: 'a list with a type that is not text',
        on: anOutput,
        patch: { type: ['INT', 1] }
      },
      { name: 'an unknown shape', on: anInput, patch: { shape: 'star' } },
      {
        name: 'an unknown direction',
        on: anInput,
        patch: { direction: 'sideways' }
      },
      {
        name: 'a NaN position',
        on: anInput,
        patch: { position: { x: Number.NaN, y: 0 } }
      },
      { name: 'a color that is not text', on: anOutput, patch: { color: 1 } },
      {
        name: 'a widget name that is not text',
        on: anInput,
        patch: { widget: 1 }
      },
      { name: 'a name another input has', on: anInput, patch: { name: 'y' } },
      { name: 'a name another output has', on: anOutput, patch: { name: 'b' } },
      {
        name: 'a widget the node does not have',
        on: anInput,
        patch: { widget: 'missing' }
      }
    ])('refuses $name before changing anything', ({ on, patch }) => {
      source.addWidget('number', 'steps', 1, () => {})
      const slot = on.slot()
      const before = JSON.stringify(on.saved())
      const version = graph._version

      expect(() =>
        Reflect.apply(slot.modify, undefined, [{ label: 'Changed' }])
      ).not.toThrow()
      const afterControl = JSON.stringify(on.saved())
      const controlVersion = graph._version

      expectRefusal(
        () => Reflect.apply(slot.modify, undefined, [patch]),
        'modify'
      )
      expect(afterControl).not.toBe(before)
      expect(JSON.stringify(on.saved())).toBe(afterControl)
      expect(graph._version).toBe(controlVersion)
      expect(controlVersion).toBeGreaterThan(version)
    })

    it('changes nothing for a slot that is gone, and still refuses an unusable patch', () => {
      const slot = input('z')
      target.removeInput(2)

      expect(slot.modify({ label: 'x' })).toBe(false)
      expectRefusal(
        () => Reflect.apply(slot.modify, undefined, [{ label: 1 }]),
        'modify'
      )
      expect(steps).toEqual([])
    })

    it.for([
      { name: 'nothing', given: () => undefined },
      { name: 'a node handle', given: () => targetHandle },
      { name: 'a slot name', given: () => 'x' }
    ])('refuses $name in place of a slot handle', ({ given }) => {
      expect(() =>
        Reflect.apply(edit.updateSlot, undefined, [given(), { label: 'x' }])
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

    it('add slots with an empty name, as many as asked', () => {
      const first = sourceHandle.outputs.add('', 'INT')
      const second = edit.addOutput(sourceHandle, '', 'INT')
      const input = targetHandle.inputs.add('', '*')

      expect([first?.name, second?.name, input?.name]).toEqual(['', '', ''])
      expect(source.outputs.map(({ name }) => name)).toEqual([
        'a',
        'b',
        'c',
        '',
        ''
      ])
    })

    it('add an input that is the socket form of a widget', () => {
      target.addWidget('number', 'steps', 1, () => {})

      const added = edit.addInput(targetHandle, 'steps', 'INT', {
        widget: 'steps'
      })

      expect(added?.isWidgetInput).toBe(true)
      expect(target.inputs[3].widget).toEqual({ name: 'steps' })
    })

    const inputs = () => targetHandle.inputs
    const outputs = () => sourceHandle.outputs

    it.for([
      { name: 'a name the side already has', on: inputs, args: ['x', 'INT'] },
      { name: 'a type that is not text', on: outputs, args: ['d', 5] },
      {
        name: 'options that are not an object',
        on: inputs,
        args: ['w', 'INT', 'optional']
      },
      {
        name: 'an unknown option',
        on: inputs,
        args: ['w', 'INT', { label: 'W' }]
      },
      {
        name: 'a widget on an output',
        on: outputs,
        args: ['d', 'INT', { widget: 'x' }]
      },
      {
        name: 'a widget the node does not have',
        on: inputs,
        args: ['w', 'INT', { widget: 'nope' }]
      },
      {
        name: 'an unknown shape',
        on: outputs,
        args: ['d', 'INT', { shape: 'hex' }]
      }
    ])('refuse $name before adding anything', ({ on, args }) => {
      const collection = on()
      const length = collection.length

      expectRefusal(
        () => Reflect.apply(collection.add, undefined, [...args]),
        'add'
      )
      expect(collection.length).toBe(length)
      expect(steps).toEqual([])
    })

    it('add nothing to a node that is gone', () => {
      graph.remove(target)

      expect(targetHandle.inputs.add('w', 'INT')).toBeUndefined()
      expect(edit.addOutput(targetHandle, 'o', 'INT')).toBeUndefined()
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

      expect(edit.removeSlot(slot)).toBe(false)
    })

    it.for([[3], [{ index: -1 }], [{ index: 1.5 }], [{}], [null]])(
      'refuses a reference that is not an id, name or position: %o',
      ([ref]) => {
        expectRefusal(
          () => Reflect.apply(targetHandle.inputs.remove, undefined, [ref]),
          'remove'
        )
        graph.remove(target)
        expectRefusal(
          () => Reflect.apply(targetHandle.inputs.remove, undefined, [ref]),
          'remove'
        )
      }
    )

    it('refuses a name two slots share', () => {
      source.addOutput('a', 'INT')

      expectRefusal(() => sourceHandle.outputs.remove('a'), 'remove')
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
      {
        side: 'input',
        node: () => targetHandle,
        slots: () => targetHandle.inputs,
        names: ['x', 'y', 'z']
      },
      {
        side: 'output',
        node: () => sourceHandle,
        slots: () => sourceHandle.outputs,
        names: ['a', 'b', 'c']
      }
    ] as const)(
      'leaves the $side order, the saved links and the undo history alone when the order is unchanged',
      ({ side, node, slots, names }) => {
        source.connect(0, target, 0)
        source.connect(2, target, 2)
        source.connect(1, target, 1)
        const saved = JSON.stringify(graph.serialize().links)
        const version = graph._version

        expect(edit.reorderSlots(node(), side, names)).toBe(true)

        expect(slots().names()).toEqual(names)
        expect(JSON.stringify(graph.serialize().links)).toBe(saved)
        expect(steps).toEqual([])
        expect(graph._version).toBe(version)
      }
    )

    it.for([
      {
        name: 'a list that leaves a slot out',
        node: () => targetHandle,
        side: 'input',
        names: ['x', 'y']
      },
      {
        name: 'a list with a slot twice',
        node: () => targetHandle,
        side: 'input',
        names: ['x', 'x', 'y']
      },
      {
        name: 'a list with a name no slot has',
        node: () => sourceHandle,
        side: 'output',
        names: ['a', 'b', 'q']
      },
      {
        name: 'something that is not a list',
        node: () => sourceHandle,
        side: 'output',
        names: 'a,b,c'
      },
      {
        name: 'a list with something that is not a name',
        node: () => targetHandle,
        side: 'input',
        names: ['x', 'y', 3]
      },
      {
        name: 'a side that is neither',
        node: () => sourceHandle,
        side: 'outputs',
        names: ['c', 'b', 'a']
      }
    ])('refuses $name before moving anything', ({ node, side, names }) => {
      const before = [
        target.inputs.map(({ name }) => name),
        source.outputs.map(({ name }) => name)
      ]

      expectRefusal(
        () =>
          Reflect.apply(edit.reorderSlots, undefined, [node(), side, names]),
        'reorderSlots'
      )
      expect([
        target.inputs.map(({ name }) => name),
        source.outputs.map(({ name }) => name)
      ]).toEqual(before)
      expect(steps).toEqual([])
    })

    it('refuses to reorder slots two of which share a name', () => {
      source.addOutput('a', 'INT')

      expectRefusal(
        () => sourceHandle.outputs.reorder(['a', 'b', 'c', 'a']),
        'reorder'
      )
    })

    it.for([
      { side: 'input', node: () => targetHandle, names: ['z', 'y', 'x'] },
      { side: 'output', node: () => sourceHandle, names: ['c', 'b', 'a'] }
    ] as const)(
      'says no and moves nothing when the link store refuses the $side links',
      ({ side, node, names }) => {
        source.connect(0, target, 0)
        vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
          ok: false,
          error: { code: 'occupied-target', message: 'refused' }
        })
        const before = [
          target.inputs.map(({ name }) => name),
          source.outputs.map(({ name }) => name)
        ]

        expect(edit.reorderSlots(node(), side, names)).toBe(false)

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
