import type {
  ModelFile,
  NodeId
} from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * A single (node, widget, model) binding detected by the missing model pipeline.
 * The same model name may appear multiple times across different nodes.
 */
export interface MissingModelCandidate {
  /** Undefined for workflow-level models not tied to a specific node. */
  nodeId?: NodeId
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

export interface EmbeddedModelWithSource extends ModelFile {
  /** Undefined for workflow-level models not tied to a specific node. */
  sourceNodeId?: NodeId
  sourceNodeType: string
  sourceWidgetName: string
}

/** View model grouping multiple candidate references under a single model name. */
export interface MissingModelViewModel {
  name: string
  representative: MissingModelCandidate
  referencingNodes: Array<{
    nodeId: NodeId
    widgetName: string
  }>
}

/** A category group of missing models sharing the same directory. */
export interface MissingModelGroup {
  directory: string | null
  models: MissingModelViewModel[]
  isAssetSupported: boolean
}

export interface MissingModelDownloadStatus {
  progress: number
  status: 'created' | 'running' | 'completed' | 'failed'
  error?: string
}
