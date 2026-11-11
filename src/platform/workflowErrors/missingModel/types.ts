import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import type { SerializedNodeId } from '@comfyorg/graph-model/nodeId'
import type { PromotedWidgetExecutionSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { ModelFile } from '@comfyorg/graph-model/workflowSchema'

export interface MissingModelPipelineResult {
  missingModels: ModelFile[]
  confirmedCandidates: MissingModelCandidate[]
}

/**
 * A single (node, widget, model) binding detected by the missing model pipeline.
 * The same model name may appear multiple times across different nodes.
 */
export interface MissingModelCandidate {
  isAssetSupported: boolean
  /**
   * - `true`  — confirmed missing
   * - `false` — confirmed installed
   * - `undefined` — pending async verification
   */
  isMissing: boolean | undefined
  name: string
  nodeType: string
  widgetName: string
  directory?: string
  hash?: string
  hashType?: string
  /** Undefined for workflow-level models not tied to a specific node. */
  nodeId?: SerializedNodeId
  promotedSources?: PromotedWidgetExecutionSource[]
  /** Available options the missing value most likely meant, best first. */
  replacements?: string[]
  /** Stored owner of nodeType/embedded url; promotedSources tracks active consumers. */
  sourceExecutionId?: NodeExecutionId
  url?: string
}

/** View model grouping multiple candidate references under a single model name. */
export interface MissingModelViewModel {
  name: string
  referencingNodes: Array<{
    nodeId: SerializedNodeId
    widgetName: string
  }>
  representative: MissingModelCandidate
  /** Replacements every referencing candidate accepts, best first. */
  replacements?: string[]
}

/** A category group of missing models sharing the same directory. */
export interface MissingModelGroup {
  directory: string | null
  isAssetSupported: boolean
  models: MissingModelViewModel[]
}
