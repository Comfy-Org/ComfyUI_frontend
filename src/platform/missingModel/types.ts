import type {
  ModelFile,
  NodeId
} from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * A single (node, widget, model) binding detected by the missing model pipeline.
 * The same model name may appear multiple times across different nodes.
 */
export interface MissingModelCandidate {
  nodeId: NodeId
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
  sourceNodeId: NodeId
  sourceNodeType: string
  sourceWidgetName: string
}
