import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { SerializedNodeId } from '@/types/nodeId'

/**
 * A single (node, widget, model) binding detected by the missing model pipeline.
 * The same model name may appear multiple times across different nodes.
 */
export interface MissingModelCandidate {
  /** Undefined for workflow-level models not tied to a specific node. */
  nodeId?: SerializedNodeId
  sourceExecutionId?: NodeExecutionId
  nodeType: string
  widgetName: string
  isAssetSupported: boolean

  name: string
  directory?: string
  url?: string
  hash?: string
  hashType?: string

  /**
   * - `true`  — confirmed missing
   * - `false` — confirmed installed
   * - `undefined` — pending async verification (asset-supported nodes only)
   */
  isMissing: boolean | undefined
}

/** View model grouping multiple candidate references under a single model name. */
export interface MissingModelViewModel {
  name: string
  representative: MissingModelCandidate
  referencingNodes: Array<{
    nodeId: SerializedNodeId
    widgetName: string
  }>
}

/** A category group of missing models sharing the same directory. */
export interface MissingModelGroup {
  directory: string | null
  models: MissingModelViewModel[]
  isAssetSupported: boolean
}
