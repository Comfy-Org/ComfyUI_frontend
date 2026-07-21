import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'

function duckInputSlot(): INodeInputSlot {
  return { name: 'in', type: 'INT', link: null, boundingRect: [0, 0, 0, 0] }
}

function createSourceAndTarget() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)
  const target = new LGraphNode('Target')
  graph.add(target)
  return { graph, source, target }
}

function mockCanvasContext() {
  return {
    fillStyle: '',
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn()
  }
}

describe('ecosystem slot patterns', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('duck-typed slots wrapped by _setConcreteSlots (M2)', () => {
    it('renders a connected duck-typed input in collapsed mode', () => {
      const { source, target } = createSourceAndTarget()
      target.inputs.push(duckInputSlot())
      source.connect(0, target, 0)

      target._setConcreteSlots()
      const ctx = mockCanvasContext()
      target.drawCollapsedSlots(ctx as unknown as CanvasRenderingContext2D)

      expect(ctx.fill).toHaveBeenCalledTimes(1)
    })

    it('upgrades duck-typed entries in node.inputs to concrete slots', () => {
      const { source, target } = createSourceAndTarget()
      target.inputs.push(duckInputSlot())
      source.connect(0, target, 0)

      target._setConcreteSlots()

      expect(target.inputs[0]).toBeInstanceOf(NodeInputSlot)
      expect((target.inputs[0] as NodeInputSlot).isConnected).toBe(true)
    })
  })

  describe("input literals without a 'link' key (M3)", () => {
    it('does not report a free input as occupied because the same-index output is connected', () => {
      const { source, target } = createSourceAndTarget()
      target.addInput('in', 'INT')
      source.connect(0, target, 0)

      const linkless: Omit<INodeInputSlot, 'link'> = {
        name: 'extra',
        type: 'INT',
        boundingRect: [0, 0, 0, 0]
      }
      source.inputs.push(linkless)

      // source: input 0 is a free linkless literal; output 0 is connected.
      expect(source.findInputSlotFree()).toBe(0)
    })

    it('does not report a connected linkless input literal as free', () => {
      const { source, target } = createSourceAndTarget()
      const linkless: Omit<INodeInputSlot, 'link'> = {
        name: 'in',
        type: 'INT',
        boundingRect: [0, 0, 0, 0]
      }
      target.inputs.push(linkless)
      source.connect(0, target, 0)

      expect(target.findInputSlotFree()).toBe(-1)
    })
  })

  describe('addInput / addOutput with legacy mirror keys (M5a)', () => {
    it('accepts extra_info that still carries a link value', () => {
      const node = new LGraphNode('n')

      expect(() => node.addInput('in', 'INT', { link: null })).not.toThrow()
      expect(node.inputs).toHaveLength(1)
      expect(node.inputs[0].name).toBe('in')
    })

    it('accepts extra_info that still carries a links value', () => {
      const node = new LGraphNode('n')

      expect(() =>
        node.addOutput('out', 'INT', { links: null, label: 'Out' })
      ).not.toThrow()
      expect(node.outputs).toHaveLength(1)
      expect(node.outputs[0].label).toBe('Out')
    })
  })
})
