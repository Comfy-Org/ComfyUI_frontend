import { RenderShape } from '@comfyorg/graph-model/globalEnums'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'

import { useLinkStore } from '@/stores/linkStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { EditCore } from '@/platform/nodeApi/v4/edit/edits'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

describe('edit contracts', () => {
  let graph: LGraph
  let comfy: Comfy
  let edit: EditCore
  let steps: string[]
  let node: LGraphNode
  let handle: NodeHandle

  beforeEach(() => {
    graph = new LGraph()
    steps = []
    ;({ comfy, edit } = createComfyApi({
      getGraph: () => graph,
      history: () => ({
        beforeChange: () => steps.push('before'),
        afterChange: () => steps.push('after')
      })
    }))
    node = new LGraphNode('Node')
    node.addInput('first', 'INT')
    node.addInput('second', 'INT')
    node.addOutput('a', 'INT')
    node.addOutput('b', 'INT')
    graph.add(node)
    const found = comfy.graph.node(String(node.id))
    assert(found)
    handle = found
  })

  describe("a node's own hook that throws part way", () => {
    it('keeps what was applied, advances the version, closes the step and passes the error on', () => {
      const failure = new Error('hook failed')
      node.onResize = () => {
        throw failure
      }
      const version = graph._version

      expect(() =>
        edit.updateNode(handle, {
          title: 'Applied',
          size: { width: 222, height: 111 }
        })
      ).toThrow(failure)

      expect(node.title).toBe('Applied')
      expect(Array.from(node.size)).toEqual([222, 111])
      expect(graph._version).toBeGreaterThan(version)
      expect(steps).toEqual(['before', 'after'])
    })
  })

  describe('properties a node keeps', () => {
    it('answers false when the node keeps its old value', () => {
      node.properties.locked = 1
      node.onPropertyChanged = () => false

      expect(handle.setProperty('locked', 5)).toBe(false)
      expect(node.properties.locked).toBe(1)
    })

    it('answers false when the node keeps one of several properties', () => {
      node.onPropertyChanged = (name) => name !== 'locked'

      expect(
        edit.updateNode(handle, { properties: { free: 1, locked: 2 } })
      ).toBe(false)
      expect(node.properties.free).toBe(1)
    })

    it('answers true when the node takes the value', () => {
      expect(handle.setProperty('free', { list: [1] })).toBe(true)
    })
  })

  describe('refusals from a handle method', () => {
    it.for([
      ['setTitle', (target: NodeHandle) => target.setTitle(Object(5))],
      ['setPosition', (target: NodeHandle) => target.setPosition(Object(null))],
      [
        'setProperty',
        (target: NodeHandle) => target.setProperty('__proto__', 1)
      ],
      [
        'modify',
        (target: NodeHandle) => target.inputs.at(0)?.modify(Object(1))
      ],
      ['add', (target: NodeHandle) => target.inputs.add('first', 'INT')],
      ['reorder', (target: NodeHandle) => target.outputs.reorder(['a'])]
    ] as const)('name %s', ([member, call]) => {
      expect(() => call(handle)).toThrow(new RegExp(`^${member} needs `))
    })
  })

  it('reads a slot name once, so a getter cannot pass the taken-name refusal', () => {
    let reads = 0
    const patch = {
      get name() {
        reads++
        return reads === 1 ? 'second' : 'fresh'
      }
    }

    expect(() => handle.inputs.at(0)?.modify(patch)).toThrow(TypeError)
    expect(reads).toBe(1)
    expect(node.inputs.map(({ name }) => name)).toEqual(['first', 'second'])
  })

  it.for(['__proto__', 'constructor', 'INT,toString'])(
    'refuses the slot type %s before adding anything',
    (type) => {
      expect(() => handle.inputs.add('third', type)).toThrow(/^add needs/)
      expect(() => handle.outputs.add('third', type)).toThrow(/^add needs/)
      expect(() => handle.inputs.at(0)?.modify({ type })).toThrow(
        /^modify needs/
      )
      expect(node.inputs).toHaveLength(2)
      expect(node.outputs).toHaveLength(2)
    }
  )

  it('applies an edit to a node whose type is missing, which saves only its mode and position', () => {
    graph.configure({
      ...graph.serialize(),
      nodes: [
        {
          id: 50,
          type: 'EditTest/NotInstalled',
          title: 'Saved',
          pos: [0, 0],
          size: [100, 50],
          flags: {},
          order: 0,
          mode: 0,
          properties: {}
        }
      ],
      links: []
    })
    const missing = comfy.graph.node('50')
    assert(missing)

    expect(missing.setTitle('Edited')).toBe(true)
    expect(missing.setPosition({ x: 7, y: 8 })).toBe(true)

    const saved = graph.serialize().nodes.find(({ id }) => String(id) === '50')
    expect(saved).toMatchObject({ title: 'Saved', pos: [7, 8] })
  })

  describe('slot references', () => {
    it('read a position once, and refuse one read through a getter', () => {
      let reads = 0
      const counted = {
        get index() {
          reads++
          return reads === 1 ? 0 : -1
        }
      }

      expect(() => handle.inputs.remove(counted)).toThrow(
        /^remove needs a slot id, a slot name or \{ index \}/
      )
      expect(reads).toBe(0)
      expect(node.inputs).toHaveLength(2)
    })

    it.for([
      ['a slot handle', () => handle.inputs.at(1)],
      ['an object with more than an index', () => ({ index: 0, name: 'x' })],
      ['an object of a class', () => Object.assign(new Date(), { index: 0 })]
    ] as const)('refuse %s', ([, ref]) => {
      expect(() => handle.inputs.remove(Object(ref()))).toThrow(TypeError)
      expect(node.inputs).toHaveLength(2)
    })

    it('take a plain { index }, and find nothing just past the end', () => {
      expect(handle.inputs.remove({ index: 2 })).toBe(false)
      expect(handle.inputs.remove({ index: 1 })).toBe(true)
      expect(node.inputs.map(({ name }) => name)).toEqual(['first'])
    })
  })

  describe('an input as the socket form of a widget', () => {
    beforeEach(() => {
      node.addWidget('number', 'steps', 1, () => {})
    })

    it('refuses a widget another input is already the socket of', () => {
      handle.inputs.at(0)?.modify({ widget: 'steps' })

      expect(() => handle.inputs.at(1)?.modify({ widget: 'steps' })).toThrow(
        TypeError
      )
      expect(() =>
        handle.inputs.add('third', 'INT', { widget: 'steps' })
      ).toThrow(TypeError)
      expect(node.inputs[1].widget).toBeUndefined()
      expect(handle.inputs.at(0)?.modify({ widget: 'steps' })).toBe(true)
    })

    it.for([
      ['null', null],
      ['undefined', undefined]
    ] as const)('stops being one with %s', ([, cleared]) => {
      handle.inputs.at(0)?.modify({ widget: 'steps' })

      handle.inputs.at(0)?.modify({ widget: cleared })

      expect(node.inputs[0].widget).toBeUndefined()
      expect(handle.inputs.at(0)?.isWidgetInput).toBe(false)
    })

    it('leaves the widget as it is when the patch does not name it', () => {
      handle.inputs.at(0)?.modify({ widget: 'steps' })

      handle.inputs.at(0)?.modify({ label: 'Shown' })

      expect(node.inputs[0].widget).toEqual({ name: 'steps' })
    })
  })

  it.for([
    ['null', null],
    ['undefined', undefined]
  ] as const)('clears a slot shape with %s', ([, cleared]) => {
    node.inputs[0].shape = RenderShape.GRID

    handle.inputs.at(0)?.modify({ shape: cleared })

    expect(node.inputs[0].shape).toBeUndefined()
  })

  describe('floating links on a reorder', () => {
    function floating(origin: [number, number], target: [number, number]) {
      const link = new LLink(
        toLinkId(-1),
        'INT',
        origin[0] === -1 ? UNASSIGNED_NODE_ID : node.id,
        origin[1],
        target[0] === -1 ? UNASSIGNED_NODE_ID : node.id,
        target[1]
      )
      const added = graph.addFloatingLink(link)
      assert(added)
      return added
    }

    it('into an input stay at the slot index the host leaves them at', () => {
      const intoSecond = floating([-1, -1], [0, 1])

      expect(handle.inputs.reorder(['second', 'first'])).toBe(true)

      expect(intoSecond.target_slot).toBe(1)
    })

    it('move with the outputs they leave', () => {
      node.addOutput('c', 'INT')
      const fromFirst = floating([0, 0], [-1, -1])

      handle.outputs.reorder(['b', 'c', 'a'])

      expect(fromFirst.origin_slot).toBe(2)
    })

    it('stay where they are when the link store refuses the reorder', () => {
      const fromFirst = floating([0, 0], [-1, -1])
      vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
        ok: false,
        error: { code: 'occupied-target', message: 'refused' }
      })

      expect(handle.outputs.reorder(['b', 'a'])).toBe(false)
      expect(fromFirst.origin_slot).toBe(0)
    })

    it("stay with another node's slots", () => {
      const other = new LGraphNode('Other')
      other.addOutput('a', 'INT')
      other.addInput('first', 'INT')
      other.addInput('second', 'INT')
      graph.add(other)
      const fromOther = graph.addFloatingLink(
        new LLink(toLinkId(-1), 'INT', other.id, 0, UNASSIGNED_NODE_ID, -1)
      )
      const intoOther = graph.addFloatingLink(
        new LLink(toLinkId(-1), 'INT', UNASSIGNED_NODE_ID, -1, other.id, 1)
      )

      handle.outputs.reorder(['b', 'a'])
      handle.inputs.reorder(['second', 'first'])

      expect(fromOther?.origin_slot).toBe(0)
      expect(intoOther?.target_slot).toBe(1)
    })
  })

  it('clamps the width to the width limit and the height to the height limit', () => {
    node.size = [300, 50]

    handle.setSizeConstraints({ maxWidth: 100, minHeight: 80, maxHeight: 500 })

    expect(Array.from(node.size)).toEqual([100, 80])
  })

  describe('values the core keeps or refuses exactly', () => {
    it('freezes comfy.edit, so no pack can replace an edit another pack calls', () => {
      expect(Object.isFrozen(edit)).toBe(true)
    })

    it.for(['constructor', 'toString', 'hasOwnProperty'])(
      'refuses %s as a patch field, though every object inherits it',
      (field) => {
        expect(() =>
          Reflect.apply(edit.updateNode, undefined, [handle, { [field]: 1 }])
        ).toThrow(TypeError)
      }
    )

    it('names updateNode when it refuses something that is not a node handle', () => {
      expect(() => Reflect.apply(edit.updateNode, undefined, [{}, {}])).toThrow(
        /^updateNode needs a node handle/
      )
    })

    it('stores a title exactly as given, and refuses one that is not text', () => {
      handle.setTitle('  padded  ')

      expect(node.title).toBe('  padded  ')
      expect(() => Reflect.apply(handle.setTitle, undefined, [5])).toThrow(
        /^setTitle /
      )
    })

    it('turns widget saving off as well as on', () => {
      handle.setSerializeWidgets(true)
      handle.setSerializeWidgets(false)

      expect(handle.isSerializingWidgets()).toBe(false)
    })

    it.for([
      ['a null limit', { minWidth: null }],
      ['autoHeight as 0', { autoHeight: 0 }],
      ['autoHeight as an empty string', { autoHeight: '' }]
    ] as const)('refuses %s in sizeConstraints', ([, constraints]) => {
      expect(() =>
        Reflect.apply(handle.setSizeConstraints, undefined, [constraints])
      ).toThrow(TypeError)
    })

    it('takes a minimum equal to its maximum', () => {
      node.size = [100, 50]

      handle.setSizeConstraints({ minWidth: 210, maxWidth: 210 })

      expect(node.size[0]).toBe(210)
    })

    it.for([
      ['zero', 0],
      ['false', false]
    ] as const)(
      'refuses a node title of %s when adding a node',
      ([, title]) => {
        expect(() =>
          Reflect.apply(comfy.graph.add, undefined, ['Any', { title }])
        ).toThrow(TypeError)
      }
    )

    it('snapshots a node id as text, and collapsed apart from pinned', () => {
      node.collapse(true)

      expect(handle.snapshot()).toMatchObject({
        id: String(node.id),
        collapsed: true,
        pinned: false
      })
    })

    it('draws badges in the order packs add them', () => {
      handle.addBadge({ text: 'first' })
      handle.addBadge({ text: 'second' })

      expect(
        node.badges.map((badge) =>
          typeof badge === 'function' ? badge().text : badge.text
        )
      ).toEqual(['first', 'second'])
    })

    it('reads and writes the right direction', () => {
      handle.outputs.at(0)?.modify({ direction: 'right' })

      expect(handle.outputs.at(0)?.snapshot()?.direction).toBe('right')
    })

    it('snapshots a connected slot as connected, and gives each target its input index', () => {
      const target = new LGraphNode('Target')
      target.addInput('x', 'INT')
      target.addInput('y', 'INT')
      graph.add(target)
      node.connect(1, target, 0)

      expect(handle.outputs.at(1)?.snapshot()?.isConnected).toBe(true)
      expect(handle.outputs.at(1)?.targets()).toEqual([
        { nodeId: String(target.id), inputIndex: 0 }
      ])
    })

    it('refuses a widget for an output, even one the node has', () => {
      node.addWidget('number', 'steps', 1, () => {})

      expect(() =>
        handle.outputs.add('c', 'INT', Object({ widget: 'steps' }))
      ).toThrow(TypeError)
      expect(node.outputs).toHaveLength(2)
    })
  })
})
