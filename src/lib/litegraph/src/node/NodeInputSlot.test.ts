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

describe('NodeInputSlot deprecated link getter', () => {
  const onWarning = vi.fn()
  const originalCallbacks = LiteGraph.onDeprecationWarning

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    onWarning.mockClear()
    LiteGraph.onDeprecationWarning = [onWarning]
    LiteGraph.alwaysRepeatWarnings = true
  })

  afterEach(() => {
    LiteGraph.onDeprecationWarning = originalCallbacks
    LiteGraph.alwaysRepeatWarnings = false
  })

  it('reflects graph and store state across the slot lifecycle', () => {
    const orphan = new LGraphNode('Orphan')
    orphan.addInput('in', 'INT')
    expect(orphan.inputs[0].link).toBeNull()

    const { source, target, link } = createConnectedPair()
    expect(target.inputs[0].link).toBe(link.id)
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('input.link is deprecated'),
      undefined
    )

    target.disconnectInput(0)
    expect(target.inputs[0].link).toBeNull()

    const relink = source.connect(0, target, 0)!
    expect(target.inputs[0].link).toBe(relink.id)
  })

  it('ignores writes, warns, and keeps the store-derived value', () => {
    const { target, link } = createConnectedPair()
    const input: { link?: LinkId | null } = target.inputs[0]

    expect(() => {
      input.link = null
    }).not.toThrow()
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('Assignment to input.link is deprecated'),
      undefined
    )
    expect(target.inputs[0].link).toBe(link.id)
  })
})
