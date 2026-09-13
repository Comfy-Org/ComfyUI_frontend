/**
 * Subgraph components.
 *
 * A subgraph is a graph that lives inside a SubgraphNode. It inherits
 * all node components (via its SubgraphNode entity) and adds structural
 * and metadata components for its interior.
 *
 * This is the most complex entity kind — it depends on Node and Link
 * extraction being complete first. See migration plan Phase 2.
 */

import type { LinkEntityId, NodeEntityId, RerouteEntityId } from '../entityId'

/**
 * The interior structure of a subgraph.
 *
 * Replaces the recursive LGraph container that Subgraph inherits.
 * Entity IDs reference entities that live in the World — not in a
 * nested graph instance.
 */
export interface SubgraphStructure {
  /** Nodes contained within the subgraph. */
  nodeIds: readonly NodeEntityId[]
  /** Internal links (both endpoints inside the subgraph). */
  linkIds: readonly LinkEntityId[]
  /** Internal reroutes. */
  rerouteIds: readonly RerouteEntityId[]
}

/** Descriptive metadata for a subgraph definition. */
export interface SubgraphMeta {
  name: string
  description?: string
}
