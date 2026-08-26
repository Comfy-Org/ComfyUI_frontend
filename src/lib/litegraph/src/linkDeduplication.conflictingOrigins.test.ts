import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type { SerialisableLLink } from '@/lib/litegraph/src/types/serialisation'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

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

interface SerializedLinkFields {
  origin_id: NodeId
  target_id: NodeId
  target_slot: number
}

function linkFieldsOf(
  link: SerialisedLLinkArray | SerialisableLLink
): SerializedLinkFields {
  if (Array.isArray(link)) {
    const [, origin_id, , target_id, target_slot] = link
    return {
      origin_id: toNodeId(origin_id),
      target_id: toNodeId(target_id),
      target_slot
    }
  }
  return {
    origin_id: toNodeId(link.origin_id),
    target_id: toNodeId(link.target_id),
    target_slot: link.target_slot
  }
}

function linksIntoTargetSlot(
  links: ReturnType<LGraph['serialize']>['links'],
  targetId: NodeId,
  targetSlot: number
): SerializedLinkFields[] {
  const fields = (links ?? []).map((link) =>
    linkFieldsOf(link as SerialisedLLinkArray | SerialisableLLink)
  )
  return fields.filter(
    ({ target_id, target_slot }) =>
      target_id === targetId && target_slot === targetSlot
  )
}

describe('normalizeConfiguredTopology with conflicting origins (#15577)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.registerNodeType('test/DupTestNode', DupTestNode)
  })

  it('keeps the link that input.link references', () => {
    const graph = configureConflictingOrigins()

    expect(graph.getNodeById(toNodeId(3))?.getInputLink(0)?.origin_id).toBe(
      toNodeId(2)
    )
  })

  it('warns when a link is dropped in favour of a different origin', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    configureConflictingOrigins()

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

  it('re-saves the workflow without changing the upstream node', () => {
    const graph = configureConflictingOrigins()

    const [survivor] = linksIntoTargetSlot(
      graph.serialize().links,
      toNodeId(3),
      0
    )

    expect(survivor?.origin_id).toBe(toNodeId(2))
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

    const mirroredId = toLinkId(++graph.state.lastLinkId)
    const output = sourceB.outputs[0]
    output.links = [...(output.links ?? []), mirroredId]
    target.inputs[0].link = mirroredId

    expect(
      linksIntoTargetSlot(graph.serialize().links, target.id, 0)
    ).toHaveLength(1)
    expect(target.getInputLink(0)?.origin_id).toBe(sourceA.id)
  })
})
