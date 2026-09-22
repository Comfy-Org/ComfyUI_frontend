import type * as Y from 'yjs'

import type { GraphMutationBatch, SemanticNodePayload } from './graphMutations'
import { toNodeId } from '@/types/nodeId'

import type { SubgraphDefinitionIndex } from './agentSubgraphHostSlots'
import {
  excludeIncompatibleLinks,
  readSemanticLink,
  readSemanticNode
} from './ecsSemanticReaders'

/**
 * The local human's edits the host has not yet reflected in the doc. A full
 * reconcile treats the doc as authoritative for everything else; without
 * this seam it would recreate a node whose delete is still on its way.
 */
export interface LocalIntent {
  /** Doc node ids (string keys) with a pending human `delete_node`. */
  pendingDeletes(workflowId: string): ReadonlySet<string>
  /**
   * Live node ids (string keys) with a pending human `add_node` the doc does
   * not hold yet. A full reconcile's `removeMissing` treats the doc as
   * authoritative for everything else; without this seam it would delete a
   * node whose add is still on its way, the same race `pendingDeletes` guards
   * for a delete.
   */
  pendingAdds(workflowId: string): ReadonlySet<string>
  /**
   * Doc link ids (string keys, matching `connect`'s `link_id`) with a
   * pending human `connect` the doc does not hold yet — the `connect`
   * sibling of {@link pendingAdds}. A full reconcile's `removeMissing`
   * treats the doc as authoritative for every other link; without this seam
   * an add-plus-connect made just before a tab switch would return to find
   * its optimistic edge removed, even though the node itself survives.
   */
  pendingConnects(workflowId: string): ReadonlySet<string>
}

export const NO_LOCAL_INTENT: LocalIntent = {
  pendingDeletes: () => new Set(),
  pendingAdds: () => new Set(),
  pendingConnects: () => new Set()
}

export type UpsertNode = (
  payload: SemanticNodePayload,
  mode: 'add' | 'reconcile'
) => void

/**
 * Explicit dependencies for {@link applyFullReconcile}, replacing the
 * `TargetSession`/adapter closure state the reconcile used to read directly:
 * every doc, index and callback it needs crosses this one small boundary
 * instead of being pulled ambiently from `EcsFollowerAdapter`.
 */
export interface FullReconcileContext {
  readonly workflowId: string
  readonly nodes: Y.Map<Y.Map<unknown>>
  readonly links: Y.Map<unknown>
  readonly reportedErrors: Set<string>
  readonly doc: Y.Doc
  readonly definitions: () => SubgraphDefinitionIndex
  readonly upsertNode: UpsertNode
  readonly batch: GraphMutationBatch
  readonly intent: LocalIntent
}

export function applyFullReconcile(ctx: FullReconcileContext): void {
  const {
    workflowId,
    nodes,
    links,
    reportedErrors,
    doc,
    definitions,
    upsertNode,
    batch,
    intent
  } = ctx
  const pendingDeletes = intent.pendingDeletes(workflowId)
  const nodePayloads = [...nodes.keys()]
    .filter((id) => !pendingDeletes.has(id))
    .flatMap((id) => {
      const payload = readSemanticNode(doc, id, definitions, reportedErrors)
      return payload ? [payload] : []
    })
  const linkPayloads = excludeIncompatibleLinks(
    [...links.keys()].flatMap((id) => {
      const link = readSemanticLink(doc, id, definitions(), reportedErrors)
      return link &&
        !pendingDeletes.has(String(link.originNodeId)) &&
        !pendingDeletes.has(String(link.targetNodeId))
        ? [link]
        : []
    }),
    reportedErrors
  )
  // A pending add's node id is not in `nodePayloads` (the doc does not have
  // it yet), but it must still be RETAINED — never deleted by `removeMissing`
  // as if the doc had authoritatively dropped it.
  const retainedNodeIds = new Set(nodePayloads.map(({ id }) => toNodeId(id)))
  for (const id of intent.pendingAdds(workflowId))
    retainedNodeIds.add(toNodeId(id))
  // A pending connect's link id is the same story as a pending add's node
  // id: the doc does not have it yet, but `removeMissing` must not treat
  // that absence as authoritative and drop the optimistic edge.
  const retainedLinkIds = new Set(linkPayloads.map(({ id }) => id))
  for (const id of intent.pendingConnects(workflowId))
    retainedLinkIds.add(Number(id))
  batch.removeMissing([...retainedNodeIds], [...retainedLinkIds])
  // NOT running the incremental path's collision classification here
  // (ADR-CRDT-RECONCILE-0035 (c), narrowed): `nodePayloads` here is read live
  // off the doc's own map on every reconcile, so `getNodeType` being defined
  // is true for every ordinarily-synced node, not only a colliding
  // local-only one — telling those apart needs (b)'s known-id set, which is
  // not landed yet (PR B). See `reportNodeCollisionIfAny`'s incremental use
  // in `applyAddedNode` for the check this path cannot yet run.
  for (const payload of nodePayloads) upsertNode(payload, 'reconcile')
  for (const link of linkPayloads) batch.connect(link)
}
