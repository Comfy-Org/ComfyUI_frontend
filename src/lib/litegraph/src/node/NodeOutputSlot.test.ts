import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LinkId } from '@/lib/litegraph/src/LLink'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

function createConnectedGraph() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  graph.add(target)

  return { graph, source, target }
}

describe('NodeOutputSlot deprecated links getter', () => {
  const onWarning = vi.fn()

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    onWarning.mockClear()
    LiteGraph.onDeprecationWarning = [onWarning]
    LiteGraph.alwaysRepeatWarnings = true
  })

  afterEach(() => {
    LiteGraph.alwaysRepeatWarnings = false
  })

  it('fires a deprecation warning on read', () => {
    const { source } = createConnectedGraph()

    void source.outputs[0].links

    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('output.links is deprecated'),
      undefined
    )
  })

  it('reflects live link store data across connect and disconnect', () => {
    const { source, target } = createConnectedGraph()

    const link = source.connect(0, target, 0)
    expect(source.outputs[0].links).toEqual([link!.id])

    source.disconnectOutput(0)
    expect(source.outputs[0].links).toBeNull()
  })

  it('returns null for an unconnected slot and for a graphless node', () => {
    const { source } = createConnectedGraph()
    expect(source.outputs[0].links).toBeNull()

    const orphan = new LGraphNode('Orphan')
    orphan.addOutput('out', 'INT')
    expect(orphan.outputs[0].links).toBeNull()
  })

  it('ignores writes, warns, and keeps the store-derived value', () => {
    const { source, target } = createConnectedGraph()
    const link = source.connect(0, target, 0)
    const slot: { links?: unknown } = source.outputs[0]

    expect(() => {
      slot.links = null
    }).not.toThrow()
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('Assignment to output.links is deprecated'),
      undefined
    )
    expect(source.outputs[0].links).toEqual([link!.id])
  })

  it('throws on mutation of the returned array', () => {
    const { source, target } = createConnectedGraph()
    source.connect(0, target, 0)

    const links = source.outputs[0].links as LinkId[]
    expect(() => links.push(links[0])).toThrow(TypeError)
  })
})
