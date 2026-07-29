import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { toNodeId } from '@/types/nodeId'

import { resolveTourRoles } from './resolveTourRoles'
import { TOUR_ROLE_PINS } from './tourRolePins'
import type { RolePin } from './tourRolePins'

const TEMPLATE_ID = 'video_wan2_2_14B_i2v'
const { source, prompt, sink } = TOUR_ROLE_PINS[TEMPLATE_ID]

function addPinnedNode(graph: LGraph, pin: RolePin) {
  const node = new LGraphNode(pin.type, pin.type)
  node.id = toNodeId(pin.id)
  graph.add(node)
  return node
}

describe('resolveTourRoles', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('resolves every pinned role on the live graph', () => {
    const root = createTestRootGraph()
    addPinnedNode(root, source!)
    addPinnedNode(root, prompt!)
    addPinnedNode(root, sink)

    expect(resolveTourRoles(root, TEMPLATE_ID)).toEqual({
      source: toNodeId(source!.id),
      promptHost: toNodeId(prompt!.id),
      sink: toNodeId(sink.id),
      mediaKind: 'video'
    })
  })

  it('nulls a missing pin and an id held by a different node type', () => {
    const root = createTestRootGraph()
    const impostor = new LGraphNode('LoadImage', 'LoadImage')
    impostor.id = toNodeId(sink.id)
    root.add(impostor)

    expect(resolveTourRoles(root, TEMPLATE_ID)).toEqual({
      source: null,
      promptHost: null,
      sink: null,
      mediaKind: 'video'
    })
  })

  it('gives an unsupported template no roles', () => {
    expect(resolveTourRoles(createTestRootGraph(), 'some_shared')).toBeNull()
  })
})
