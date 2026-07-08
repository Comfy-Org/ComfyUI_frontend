import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LinkId } from '@/lib/litegraph/src/LLink'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

function createConnectedPair() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  graph.add(source)
  graph.add(target)
  const link = source.connect(0, target, 0)!
  return { graph, source, target, link }
}

describe('deprecated slot link mirrors', () => {
  const deprecationCallback = vi.fn()
  const originalCallbacks = LiteGraph.onDeprecationWarning

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    deprecationCallback.mockClear()
    LiteGraph.onDeprecationWarning = [deprecationCallback]
    LiteGraph.alwaysRepeatWarnings = true
  })

  afterEach(() => {
    LiteGraph.onDeprecationWarning = originalCallbacks
    LiteGraph.alwaysRepeatWarnings = false
  })

  describe('NodeInputSlot.link', () => {
    it('returns the link id for a connected input and warns', () => {
      const { target, link } = createConnectedPair()

      expect(target.inputs[0].link).toBe(link.id)
      expect(deprecationCallback).toHaveBeenCalledWith(
        expect.stringContaining('input.link is deprecated'),
        undefined
      )
    })

    it('returns null for a disconnected input and warns', () => {
      const { target } = createConnectedPair()
      target.disconnectInput(0)

      expect(target.inputs[0].link).toBeNull()
      expect(deprecationCallback).toHaveBeenCalledWith(
        expect.stringContaining('input.link is deprecated'),
        undefined
      )
    })

    it('returns null for an input on a node detached from any graph', () => {
      const node = new LGraphNode('Detached')
      node.addInput('in', 'INT')

      expect(node.inputs[0].link).toBeNull()
    })

    it('ignores writes, warns, and keeps the store-derived value', () => {
      const { target, link } = createConnectedPair()
      const input: { link?: LinkId | null } = target.inputs[0]

      expect(() => {
        input.link = null
      }).not.toThrow()
      expect(deprecationCallback).toHaveBeenCalledWith(
        expect.stringContaining('Assignment to input.link is deprecated'),
        undefined
      )
      expect(target.inputs[0].link).toBe(link.id)
    })
  })

  describe('NodeOutputSlot.links', () => {
    it('returns the link ids for a connected output and warns', () => {
      const { source, link } = createConnectedPair()

      expect(source.outputs[0].links).toEqual([link.id])
      expect(deprecationCallback).toHaveBeenCalledWith(
        expect.stringContaining('output.links is deprecated'),
        undefined
      )
    })

    it('returns null for a disconnected output and warns', () => {
      const { source } = createConnectedPair()
      source.disconnectOutput(0)

      expect(source.outputs[0].links).toBeNull()
      expect(deprecationCallback).toHaveBeenCalledWith(
        expect.stringContaining('output.links is deprecated'),
        undefined
      )
    })

    it('returns null for an output on a node detached from any graph', () => {
      const node = new LGraphNode('Detached')
      node.addOutput('out', 'INT')

      expect(node.outputs[0].links).toBeNull()
    })

    it('ignores writes, warns, and keeps the store-derived value', () => {
      const { source, link } = createConnectedPair()
      const output: { links?: readonly LinkId[] | null } = source.outputs[0]

      expect(() => {
        output.links = null
      }).not.toThrow()
      expect(deprecationCallback).toHaveBeenCalledWith(
        expect.stringContaining('Assignment to output.links is deprecated'),
        undefined
      )
      expect(source.outputs[0].links).toEqual([link.id])
    })
  })
})
