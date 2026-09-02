import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'

import type { LLink } from './LLink'
import type { ISerialisedNode } from './types/serialisation'
import type { EndpointPatch } from '@/stores/linkStore'
import type { NodeId } from '@/types/nodeId'

/**
 * Follows serialized link endpoints through node-id remints during
 * `LGraph.configure` (ADR-ECS, "Collision recovery lives at the remint
 * site").
 *
 * A payload's links name its nodes by their serialized (requested) ids. When
 * `attachNodeToStores` remints a colliding id, endpoints keyed on the
 * requested id would otherwise attach to whichever incumbent kept that id —
 * link theft — or dangle. Recording requested→final ids during the
 * node-creation pass and remapping the payload's own links closes that gap.
 *
 * Only unambiguous remints are remapped: a serialized id requested by more
 * than one payload node cannot name a single node, so links referencing it
 * keep the first claimant (the pre-remap behaviour). Chained remints (a
 * minted id colliding with a later node's requested id) stay correct because
 * every endpoint is looked up exactly once against requested ids, never
 * re-resolved through intermediate mints.
 */

/** Counts how many payload nodes request each serialized id. */
export function countRequestedNodeIds(
  nodesData: readonly ISerialisedNode[] | undefined
): Map<NodeId, number> {
  const counts = new Map<NodeId, number>()
  if (!nodesData) return counts
  for (const nodeData of nodesData) {
    const requestedId = toNodeId(nodeData.id)
    counts.set(requestedId, (counts.get(requestedId) ?? 0) + 1)
  }
  return counts
}

/**
 * Records a remint into {@link remintedIds} unless the requested id is
 * ambiguous (claimed by more than one payload node).
 */
export function recordUnambiguousRemint(
  remintedIds: Map<NodeId, NodeId>,
  requestedIdCounts: ReadonlyMap<NodeId, number>,
  requestedId: NodeId,
  finalId: NodeId
): void {
  if (requestedId === UNASSIGNED_NODE_ID) return
  if (requestedIdCounts.get(requestedId) === 1) {
    remintedIds.set(requestedId, finalId)
  }
}

/** Returns the endpoint patch needed to follow unambiguous node-id remints. */
export function getRemintedEndpointPatch(
  link: LLink,
  remintedIds: ReadonlyMap<NodeId, NodeId>
): EndpointPatch | undefined {
  const originNodeId = remintedIds.get(link.origin_id)
  const targetNodeId = remintedIds.get(link.target_id)
  if (originNodeId === undefined && targetNodeId === undefined) return
  return {
    ...(originNodeId === undefined ? {} : { originNodeId }),
    ...(targetNodeId === undefined ? {} : { targetNodeId })
  }
}
