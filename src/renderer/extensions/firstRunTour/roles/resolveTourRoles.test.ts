import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { toNodeId } from '@/types/nodeId'

import { resolveTourRoles } from './resolveTourRoles'
import { TOUR_ROLE_PINS } from './tourRolePins'
import type { RolePin } from './tourRolePins'

const TEMPLATE_ID = 'video_wan2_2_14B_i2v'
const { source, prompt, sink, mediaKind } = TOUR_ROLE_PINS[TEMPLATE_ID]

if (!source || !prompt) {
  throw new Error(
    `${TEMPLATE_ID} must pin a source and a prompt for this suite`
  )
}

function addPinnedNode(graph: LGraph | Subgraph, pin: RolePin) {
  const node = new LGraphNode(pin.type, pin.type)
  node.id = toNodeId(pin.id)
  graph.add(node)
  return node
}

/** Mirrors a loaded template: a subgraph definition registered on the root graph, plus its instance. */
function addHostedSubgraph(root: LGraph, parent: LGraph | Subgraph = root) {
  const subgraph = createTestSubgraph({ rootGraph: root })
  root.subgraphs.set(subgraph.id, subgraph)
  const host = createTestSubgraphNode(subgraph, { parentGraph: parent })
  parent.add(host)
  return { subgraph, host }
}

describe('resolveTourRoles', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('spotlights a prompt pinned inside a subgraph through its root-graph host', () => {
    const root = createTestRootGraph()
    const { subgraph, host } = addHostedSubgraph(root)
    addPinnedNode(root, source)
    addPinnedNode(root, sink)
    addPinnedNode(subgraph, prompt)

    expect(resolveTourRoles(root, TEMPLATE_ID)).toEqual({
      source: toNodeId(source.id),
      promptHost: host.id,
      sink: toNodeId(sink.id),
      mediaKind
    })
  })

  it('host-maps every role, not only the prompt', () => {
    const root = createTestRootGraph()
    const { subgraph, host } = addHostedSubgraph(root)
    addPinnedNode(subgraph, source)
    addPinnedNode(subgraph, prompt)
    addPinnedNode(subgraph, sink)

    const roles = resolveTourRoles(root, TEMPLATE_ID)

    expect(roles?.source, 'source pinned inside a subgraph').toBe(host.id)
    expect(roles?.sink, 'sink pinned inside a subgraph').toBe(host.id)
  })

  it('walks nested subgraphs up to the outermost host', () => {
    const root = createTestRootGraph()
    const outer = addHostedSubgraph(root)
    const inner = addHostedSubgraph(root, outer.subgraph)
    addPinnedNode(inner.subgraph, prompt)

    expect(resolveTourRoles(root, TEMPLATE_ID)?.promptHost).toBe(outer.host.id)
  })

  it('degrades a pin the live graph no longer contains to null', () => {
    const root = createTestRootGraph()
    addPinnedNode(root, sink)

    expect(resolveTourRoles(root, TEMPLATE_ID)).toEqual({
      source: null,
      promptHost: null,
      sink: toNodeId(sink.id),
      mediaKind
    })
  })

  it('ignores a pinned id the live graph fills with a different node', () => {
    const root = createTestRootGraph()
    const impostor = new LGraphNode('LoadImage', 'LoadImage')
    impostor.id = toNodeId(sink.id)
    root.add(impostor)

    expect(
      resolveTourRoles(root, TEMPLATE_ID)?.sink,
      'ids are plain numbers, so another workflow can hold this one'
    ).toBeNull()
  })

  it('gives an unsupported template no roles, so no tour starts', () => {
    const root = createTestRootGraph()
    addPinnedNode(root, sink)

    expect(resolveTourRoles(root, 'some_shared_workflow')).toBeNull()
  })
})
