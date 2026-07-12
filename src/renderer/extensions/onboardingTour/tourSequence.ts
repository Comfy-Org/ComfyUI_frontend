import type { NodeId } from '@/types/nodeId'

/**
 * The kind of media a resolved sink produces, used to pick the Result step's
 * renderer (image vs video player) and to shape telemetry.
 */
export type MediaKind = 'image' | 'video'

/**
 * How to reach the editable prompt widget. The widget is (in every known
 * template) nested inside a subgraph node, so the resolver returns the path to
 * it plus the subgraph's exposed `prompt` input port as a fallback spotlight
 * target when programmatic focus of the inner widget fails.
 */
interface PromptRole {
  subgraphNodeId: NodeId
  innerNodeId: NodeId
  widgetName: string
  /** Name of the exposed input port on the collapsed subgraph node. */
  portFallback: string | null
}

/** A resolved graph node targeted by a tour step. */
interface NodeRole {
  nodeId: NodeId
}

/**
 * The roles the resolver extracts from a loaded graph. Any role may be null
 * when it cannot be resolved; the sequence builder omits the corresponding
 * step rather than failing (graceful degradation).
 */
export interface ResolvedRoles {
  /** Top-level input image node (absent for text-to-image → Upload step skipped). */
  source: NodeRole | null
  prompt: PromptRole | null
  engine: NodeRole | null
  sink: NodeRole | null
  mediaKind: MediaKind
}
