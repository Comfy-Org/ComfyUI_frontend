import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { createDetachedTargetSession } from '@/core/graph/document/detachedTargetSession'
import { createGraphMutations } from '@/core/graph/graphMutations'
import type { SemanticLayoutMutationPort } from '@/core/graph/graphMutations'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createTargetFrameApplyPort } from '@/workbench/extensions/agent/crdt/targetFrameProjection'

const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}
const workflowId = 'wf-atomic'

interface StoredLayout {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

/**
 * Stands in for the renderer's layout store: it owns real state, so a rolled
 * back commit has to put that state back rather than merely skip a spy call.
 */
function layoutOwner(refusedNodeId: () => NodeId | null) {
  const layouts = new Map<NodeId, StoredLayout>()
  const port: SemanticLayoutMutationPort = {
    createNode(_scope, nodeId, layout) {
      if (refusedNodeId() === nodeId)
        throw new Error(`layout port refused ${String(nodeId)}`)
      layouts.set(nodeId, structuredClone(layout))
    },
    deleteNodes(_scope, nodeIds) {
      for (const nodeId of nodeIds) layouts.delete(nodeId)
    },
    captureNodes(_scope, nodeIds) {
      const captured = nodeIds.map(
        (nodeId) => [nodeId, layouts.get(nodeId)] as const
      )
      return {
        restore() {
          for (const [nodeId, layout] of captured) {
            if (layout) layouts.set(nodeId, layout)
            else layouts.delete(nodeId)
          }
        }
      }
    }
  }
  return { port, layouts }
}

/**
 * The host's copy of the target document. Frames carry the incremental diff
 * between edits, so a later frame genuinely rewrites what an earlier one
 * committed instead of losing to it in Yjs conflict resolution.
 */
function targetHost() {
  const doc = new Y.Doc()
  let delivered = Y.encodeStateVector(doc)
  let seq = 0
  return function edit(mutate: (nodes: Y.Map<Y.Map<unknown>>) => void) {
    doc.transact(() => mutate(doc.getMap<Y.Map<unknown>>('nodes')))
    const update = Y.encodeStateAsUpdate(doc, delivered)
    delivered = Y.encodeStateVector(doc)
    seq += 1
    return { workflowId, seq, update, actor: 'agent-a' }
  }
}

function putNode(
  nodes: Y.Map<Y.Map<unknown>>,
  id: string,
  type: string,
  seed: number,
  x: number
) {
  const existing = nodes.get(id)
  const node = existing ?? new Y.Map<unknown>()
  if (!existing) nodes.set(id, node)
  node.set('type', type)
  node.set('pos', [x, 20])
  node.set('size', [200, 100])
  node.set('widgets_values', { seed })
}

function ecsSnapshot() {
  const nodes = useNodeDataStore().getGraphNodesFor('root', 'root')
  const widgetStore = useWidgetValueStore()
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      seed: widgetStore.getWidget(widgetId('root', node.id, 'seed'))?.value
    })),
    links: [...useLinkStore().graphTopologies(scope)].map((link) => link.id)
  }
}

describe('detached target commit atomicity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('publishes nothing when a later commit step fails, then retries once', () => {
    let refused: NodeId | null = toNodeId(8)
    const { port: layout, layouts } = layoutOwner(() => refused)
    const session = createDetachedTargetSession(workflowId)
    const applyPort = createTargetFrameApplyPort(
      createGraphMutations({ getScope: () => scope, layout })
    )
    const edit = targetHost()

    session.enqueue(
      edit((nodes) => {
        putNode(nodes, '7', 'Type7', 42, 10)
        putNode(nodes, '8', 'Type8', 43, 30)
      })
    )

    expect(session.commitNext(applyPort).status).toBe('failed')
    expect(ecsSnapshot()).toEqual({ nodes: [], links: [] })
    expect([...layouts.keys()]).toEqual([])
    expect(session.snapshot()).toMatchObject({
      revision: 0,
      committedSeq: null,
      queuedFrames: 1,
      needsResync: false,
      lastCommitId: null
    })

    refused = null

    expect(session.commitNext(applyPort).status).toBe('committed')
    expect(ecsSnapshot()).toEqual({
      nodes: [
        { id: '7', type: 'Type7', seed: 42 },
        { id: '8', type: 'Type8', seed: 43 }
      ],
      links: []
    })
    expect(
      [...layouts.entries()].map(([id, stored]) => [id, stored.position.x])
    ).toEqual([
      [toNodeId(7), 10],
      [toNodeId(8), 30]
    ])
    expect(session.snapshot()).toMatchObject({
      revision: 1,
      committedSeq: 1,
      queuedFrames: 0
    })
    expect(session.commitNext(applyPort).status).toBe('idle')
  })

  it('rolls the semantic stores back for a port that cannot capture layout', () => {
    const { port, layouts } = layoutOwner(() => toNodeId(8))
    const { captureNodes: _unsupported, ...withoutCapture } = port
    const session = createDetachedTargetSession(workflowId)
    const applyPort = createTargetFrameApplyPort(
      createGraphMutations({ getScope: () => scope, layout: withoutCapture })
    )
    const edit = targetHost()

    session.enqueue(
      edit((nodes) => {
        putNode(nodes, '7', 'Type7', 42, 10)
        putNode(nodes, '8', 'Type8', 43, 30)
      })
    )

    expect(session.commitNext(applyPort).status).toBe('failed')
    expect(ecsSnapshot()).toEqual({ nodes: [], links: [] })
    expect([...layouts.keys()]).toEqual([])
  })

  it('keeps the previously committed content when a replacing frame fails', () => {
    let refused: NodeId | null = null
    const { port: layout, layouts } = layoutOwner(() => refused)
    const session = createDetachedTargetSession(workflowId)
    const applyPort = createTargetFrameApplyPort(
      createGraphMutations({ getScope: () => scope, layout })
    )
    const edit = targetHost()

    session.enqueue(edit((nodes) => putNode(nodes, '7', 'Type7', 42, 10)))
    expect(session.commitNext(applyPort).status).toBe('committed')
    const committed = ecsSnapshot()
    const committedLayouts = JSON.stringify([...layouts.entries()])

    refused = toNodeId(9)
    session.enqueue(
      edit((nodes) => {
        putNode(nodes, '7', 'Type7Replaced', 99, 500)
        putNode(nodes, '9', 'Type9', 7, 700)
      })
    )

    expect(session.commitNext(applyPort).status).toBe('failed')
    expect(ecsSnapshot()).toEqual(committed)
    expect(JSON.stringify([...layouts.entries()])).toEqual(committedLayouts)
    expect(session.snapshot()).toMatchObject({
      revision: 1,
      committedSeq: 1,
      queuedFrames: 1
    })
  })
})
