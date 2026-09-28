import type { LGraphNode, Subgraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import type { NodeId } from '@/types/nodeId'

import type { ComfyWorkflow, LoadedComfyWorkflow } from './comfyWorkflow'

/**
 * Exposed store interface for the workflow store.
 * Explicitly typed to avoid trigger following error:
 * error TS7056: The inferred type of this node exceeds the maximum length the
 * compiler will serialize. An explicit type annotation is needed.
 */
export interface WorkflowStore {
  activeWorkflow: LoadedComfyWorkflow | null
  attachWorkflow: (workflow: ComfyWorkflow, openIndex?: number) => void
  isActive: (workflow: ComfyWorkflow) => boolean
  openWorkflows: ComfyWorkflow[]
  openedWorkflowIndexShift: (shift: number) => ComfyWorkflow | null
  getMostRecentWorkflow: () => ComfyWorkflow | null
  openWorkflow: (workflow: ComfyWorkflow) => Promise<LoadedComfyWorkflow>
  openWorkflowsInBackground: (paths: {
    left?: string[]
    right?: string[]
  }) => void
  isOpen: (workflow: ComfyWorkflow) => boolean
  isBusy: boolean
  closeWorkflow: (workflow: ComfyWorkflow) => Promise<void>
  createTemporary: (
    path?: string,
    workflowData?: ComfyWorkflowJSON
  ) => ComfyWorkflow
  createNewTemporary: (
    path?: string,
    workflowData?: ComfyWorkflowJSON
  ) => ComfyWorkflow
  renameWorkflow: (workflow: ComfyWorkflow, newPath: string) => Promise<void>
  deleteWorkflow: (workflow: ComfyWorkflow) => Promise<void>
  saveAs: (existingWorkflow: ComfyWorkflow, path: string) => ComfyWorkflow
  saveWorkflow: (workflow: ComfyWorkflow) => Promise<void>

  workflows: ComfyWorkflow[]
  bookmarkedWorkflows: ComfyWorkflow[]
  persistedWorkflows: ComfyWorkflow[]
  modifiedWorkflows: ComfyWorkflow[]
  getWorkflowByPath: (path: string) => ComfyWorkflow | null
  syncWorkflows: (dir?: string) => Promise<void>
  isSyncLoading: boolean
  loadWorkflows: () => Promise<void>
  reorderWorkflows: (from: number, to: number) => void

  /** `true` if any subgraph is currently being viewed. */
  isSubgraphActive: boolean
  activeSubgraph: Subgraph | undefined
  /** Updates the {@link subgraphNamePath} and {@link isSubgraphActive} values. */
  updateActiveGraph: () => void
  executionIdToCurrentId: (id: string) => string | undefined
  nodeIdToNodeLocatorId: (nodeId: NodeId, subgraph?: Subgraph) => NodeLocatorId
  nodeToNodeLocatorId: (node: LGraphNode) => NodeLocatorId
  nodeLocatorIdToNodeId: (locatorId: NodeLocatorId) => NodeId | null
  nodeLocatorIdToNodeExecutionId: (
    locatorId: NodeLocatorId,
    targetSubgraph?: Subgraph
  ) => NodeExecutionId | null
}
