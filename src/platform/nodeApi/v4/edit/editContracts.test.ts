import { RenderShape } from '@comfyorg/graph-model/globalEnums'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'

import { useLinkStore } from '@/stores/linkStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

describe('edit contracts', () => {
  let graph: LGraph
  let comfy: Comfy
  let steps: string[]
  let node: LGraphNode
  let handle: NodeHandle

  beforeEach(() => {
    graph = new LGraph()
    steps = []
    ;({ comfy } = createComfyApi({
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
        comfy.edit.updateNode(handle, {
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
        comfy.edit.updateNode(handle, { properties: { free: 1, locked: 2 } })
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
      ['add', (target: NodeHandle) => target.inputs.add('', 'INT')],
      ['reorder', (target: NodeHandle) => target.outputs.reorder(['a'])]
    ] as const)('name %s', ([member, call]) => {
      expect(() => call(handle)).toThrow(new RegExp(`^${member} needs `))
    })
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

    it('move with the inputs they reach', () => {
      const intoSecond = floating([-1, -1], [0, 1])

      handle.inputs.reorder(['second', 'first'])

      expect(intoSecond.target_slot).toBe(0)
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

  describe('the resizable choice', () => {
    it('is reapplied once per pin change however many APIs a page has', () => {
      const second = createComfyApi({ getGraph: () => graph }).comfy
      handle.setResizable(false)
      second.graph.node(String(node.id))?.setResizable(false)
      const write = vi.spyOn(node, 'resizable', 'set')

      node.pin(true)

      expect(write.mock.calls).toEqual([[false], [false]])
    })
  })
})
