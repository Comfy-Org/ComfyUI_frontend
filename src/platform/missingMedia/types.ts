import type { SerializedNodeId } from '@/types/nodeId'
import type { NodeExecutionId } from '@/types/nodeIdentification'

export type MediaType = 'image' | 'video' | 'audio'

/**
 * A single (node, widget, media file) binding detected by the missing media pipeline.
 * The same file name may appear multiple times across different nodes.
 */
export interface MissingMediaCandidate {
  nodeId: SerializedNodeId
  nodeType: string
  widgetName: string
  /**
   * For a promoted widget, the interior node and widget the value really
   * belongs to. Node-level validation errors are never lifted to the host, so
   * matching them needs the source identity the host name hides.
   */
  sourceExecutionId?: NodeExecutionId
  sourceWidgetName?: string
  mediaType: MediaType
  /** Display name (plain filename for OSS, asset hash for cloud). */
  name: string
  /**
   * - `true`  — confirmed missing
   * - `false` — confirmed present
   * - `undefined` — pending async verification. Cloud candidates start pending;
   *   OSS output annotated paths may also be deferred to generated-history
   *   verification.
   */
  isMissing: boolean | undefined
}

/** View model grouping multiple candidate references under a single file name. */
export interface MissingMediaViewModel {
  name: string
  mediaType: MediaType
  representative: MissingMediaCandidate
  referencingNodes: Array<{
    nodeId: SerializedNodeId
    nodeType?: string
    widgetName: string
  }>
}

/** A group of missing media items sharing the same media type. */
export interface MissingMediaGroup {
  mediaType: MediaType
  items: MissingMediaViewModel[]
}
