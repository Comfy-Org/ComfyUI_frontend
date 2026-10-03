import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { SerializedNodeId } from '@/types/nodeId'
import type { ModelSource } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { PromotedWidgetExecutionSource } from '@/core/graph/subgraph/promotedWidgetTypes'

/**
 * A single (node, widget, model) binding detected by the missing model pipeline.
 * The same model name may appear multiple times across different nodes.
 */
export interface MissingModelCandidate {
  /** Undefined for workflow-level models not tied to a specific node. */
  nodeId?: SerializedNodeId
  /** Stored owner of nodeType/embedded url; promotedSources tracks active consumers. */
  sourceExecutionId?: NodeExecutionId
  promotedSources?: PromotedWidgetExecutionSource[]
  nodeType: string
  widgetName: string
  isAssetSupported: boolean

  name: string
  directory?: string
  url?: string
  sources?: ModelSource[]
  hash?: string
  hashType?: string

  /**
   * - `true`  — confirmed missing
   * - `false` — confirmed installed
   * - `undefined` — pending async verification
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
