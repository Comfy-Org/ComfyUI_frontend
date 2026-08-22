import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { conflictingOriginLinksRoot } from './__fixtures__/duplicateLinks'

class DupTestNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'DupTestNode')
    this.addInput('input_0', 'number')
    this.addOutput('output_0', 'number')
  }
}

function configureConflictingOrigins() {
  const graph = new LGraph()
  graph.configure(structuredClone(conflictingOriginLinksRoot))
  return graph
}

function linksIntoTargetSlot(
  links: ReturnType<LGraph['serialize']>['links'],
  targetId: number,
  targetSlot: number
) {
  return (links ?? []).filter((link) => {
    const [, , , target_id, target_slot] = Array.isArray(link)
      ? link
      : [
          link.id,
          link.origin_id,
          link.origin_slot,
          link.target_id,
          link.target_slot
        ]
    return target_id === targetId && target_slot === targetSlot
  })
}

describe('normalizeConfiguredTopology with conflicting origins (#15577)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.registerNodeType('test/DupTestNode', DupTestNode)
  })

  it.fails('keeps the link that input.link references', () => {
    const graph = configureConflictingOrigins()

    expect(graph.getNodeById(toNodeId(3))?.getInputLink(0)?.origin_id).toBe(
      toNodeId(2)
    )
  })

  it.fails('warns when a link is dropped in favour of a different origin', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    configureConflictingOrigins()

    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls.flat().join(' ')).toContain('3:0')
  })

  it('registers exactly one link at the contested input', () => {
    const graph = configureConflictingOrigins()

    expect(graph.links.size).toBe(1)
    expect(
      useLinkStore().getInputSlotLink(graphScopeOf(graph), toNodeId(3), 0)
    ).toBeDefined()
    expect(graph.getNodeById(toNodeId(3))?.getInputLink(0)).toBeDefined()
  })

  it.fails('re-saves the workflow without changing the upstream node', () => {
    const graph = configureConflictingOrigins()

    const [survivor] = linksIntoTargetSlot(graph.serialize().links, 3, 0)
    const origin = Array.isArray(survivor) ? survivor[1] : survivor.origin_id

    expect(origin).toBe(toNodeId(2))
  })
})

describe('legacy mirror link creation (#15577 reachability)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.registerNodeType('test/DupTestNode', DupTestNode)
  })

  it('discards a link written only through the legacy slot mirrors', () => {
    const graph = new LGraph()
    const sourceA = LiteGraph.createNode('test/DupTestNode')!
    const sourceB = LiteGraph.createNode('test/DupTestNode')!
    const target = LiteGraph.createNode('test/DupTestNode')!
    graph.add(sourceA)
    graph.add(sourceB)
    graph.add(target)
    sourceA.connect(0, target, 0)

    const mirroredId = ++graph.state.lastLinkId
    const output = sourceB.outputs[0]
    output.links = [...(output.links ?? []), mirroredId]
    target.inputs[0].link = mirroredId

    expect(
      linksIntoTargetSlot(graph.serialize().links, Number(target.id), 0)
    ).toHaveLength(1)
    expect(target.getInputLink(0)?.origin_id).toBe(sourceA.id)
  })
})
