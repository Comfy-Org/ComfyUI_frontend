import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { ChangeTracker } from './changeTracker'

function createTopologyGraph() {
  const graph = new LGraph()

  const source = new LGraphNode('source')
  source.addOutput('out', 'number')

  const floatingTarget = new LGraphNode('floating-target')
  floatingTarget.addInput('in', 'number')

  const linkedTarget = new LGraphNode('linked-target')
  linkedTarget.addInput('in', 'number')

  graph.add(source)
  graph.add(floatingTarget)
  graph.add(linkedTarget)

  source.connect(0, floatingTarget, 0)
  source.connect(0, linkedTarget, 0)

  const link = graph.getLink(floatingTarget.inputs[0].link)
  if (!link) throw new Error('Expected link')

  graph.createReroute([100, 100], link)
  floatingTarget.disconnectInput(0, true)

  return graph
}

describe('ChangeTracker.graphEqual', () => {
  it('returns false when links differ', () => {
    const graph = createTopologyGraph()
    const stateA = graph.asSerialisable() as unknown as ComfyWorkflowJSON
    const stateB = structuredClone(stateA)

    stateB.links = []

    expect(ChangeTracker.graphEqual(stateA, stateB)).toBe(false)
  })

  it('returns false when floatingLinks differ', () => {
    const graph = createTopologyGraph()
    const stateA = graph.asSerialisable() as unknown as ComfyWorkflowJSON
    const stateB = structuredClone(stateA)

    stateB.floatingLinks = []

    expect(ChangeTracker.graphEqual(stateA, stateB)).toBe(false)
  })

  it('returns false when reroutes differ', () => {
    const graph = createTopologyGraph()
    const stateA = graph.asSerialisable() as unknown as ComfyWorkflowJSON
    const stateB = structuredClone(stateA)

    stateB.reroutes = []

    expect(ChangeTracker.graphEqual(stateA, stateB)).toBe(false)
  })
})
