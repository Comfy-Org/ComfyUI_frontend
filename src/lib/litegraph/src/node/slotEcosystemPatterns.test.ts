import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
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
    LiteGraph.alwaysRepeatWarnings = true
  })

  afterEach(() => {
    LiteGraph.alwaysRepeatWarnings = false
    LiteGraph.onDeprecationWarning = []
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

  describe('direct writes to the deprecated mirrors (M5b)', () => {
    it('ignores input.link writes and fires telemetry', () => {
      const deprecationCallback = vi.fn()
      LiteGraph.onDeprecationWarning = [deprecationCallback]
      const node = new LGraphNode('n')
      const input = node.addInput('in', 'INT')

      const legacyWriter = input as { link?: unknown }
      expect(() => {
        legacyWriter.link = 42
      }).not.toThrow()
      expect(deprecationCallback).toHaveBeenCalledWith(
        expect.stringMatching(/input\.link.*connect\(\).*disconnectInput\(\)/),
        undefined
      )
      expect(input.link).toBeNull()
    })

    it('ignores output.links writes and fires telemetry', () => {
      const deprecationCallback = vi.fn()
      LiteGraph.onDeprecationWarning = [deprecationCallback]
      const node = new LGraphNode('n')
      const output = node.addOutput('out', 'INT')

      const legacyWriter = output as { links?: unknown }
      expect(() => {
        legacyWriter.links = [1]
      }).not.toThrow()
      expect(deprecationCallback).toHaveBeenCalledWith(
        expect.stringMatching(
          /output\.links.*connect\(\).*disconnectOutput\(\)/
        ),
        undefined
      )
      expect(output.links).toBeNull()
    })
  })

  describe('plain-object slot reads after concretisation (M6a)', () => {
    it('reads the store-derived link id through the upgraded slot', () => {
      const { graph, source, target } = createSourceAndTarget()
      target.inputs.push(duckInputSlot())
      const link = source.connect(0, target, 0)

      target._setConcreteSlots()

      expect(link).not.toBeNull()
      expect(target.inputs[0].link).toBe(link!.id)
      expect(graph.getLink(target.inputs[0].link!)).toBe(link)
    })
  })
})
