import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'

export type MediaType = 'image' | 'video' | 'audio'

/**
 * A single (node, widget, media file) binding detected by the missing media pipeline.
 * The same file name may appear multiple times across different nodes.
 */
export interface MissingMediaCandidate {
  nodeId: NodeId
  nodeType: string
  widgetName: string
  mediaType: MediaType
  /** Display name (plain filename for OSS, asset hash for cloud). */
  name: string
  /**
   * - `true`  — confirmed missing
   * - `false` — confirmed present
   * - `undefined` — pending async verification (cloud only)
   */
  isMissing: boolean | undefined
}

/** View model grouping multiple candidate references under a single file name. */
export interface MissingMediaViewModel {
  name: string
  mediaType: MediaType
  referencingNodes: Array<{
    nodeId: NodeId
    widgetName: string
  }>
}

/** A group of missing media items sharing the same media type. */
export interface MissingMediaGroup {
  mediaType: MediaType
  items: MissingMediaViewModel[]
}
