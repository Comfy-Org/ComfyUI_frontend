import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionOutput } from '@/schemas/apiSchema'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { WorkflowOpenSource } from '@/platform/telemetry/types'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'

import type { ComfyWidgetConstructor } from '@/scripts/widgets'

export interface IComfyApp {
  vueAppReady: boolean
  rootGraph: LGraph
  canvas: LGraphCanvas
  configuringGraph: boolean
  nodeOutputs: Record<string, NodeExecutionOutput>

  /** @deprecated storageLocation is always 'server' */
  readonly storageLocation: string
  /** @deprecated storage migration is no longer needed */
  readonly isNewUserSession: boolean
  /** @deprecated Use useExecutionStore().lastExecutionError instead */
  readonly lastExecutionError: unknown
  /** @deprecated Use useWidgetStore().widgets instead */
  readonly widgets: Record<string, ComfyWidgetConstructor>

  getPreviewFormatParam(): string

  loadGraphData(
    graphData?: ComfyWorkflowJSON,
    clean?: boolean,
    restore_view?: boolean,
    workflow?: string | null | ComfyWorkflow,
    options?: {
      showMissingNodesDialog?: boolean
      showMissingModelsDialog?: boolean
      checkForRerouteMigration?: boolean
      openSource?: WorkflowOpenSource
    }
  ): Promise<void>

  graphToPrompt(graph?: LGraph): Promise<{
    workflow: ComfyWorkflowJSON
    output: Record<string, unknown>
  }>

  queuePrompt(
    number: number,
    batchCount?: number,
    queueNodeIds?: string[]
  ): Promise<boolean>

  clean(): void

  handleFile(file: File, openSource?: WorkflowOpenSource): Promise<void>

  registerExtension(extension: ComfyExtension): void

  registerNodeDef(nodeId: string, nodeDef: ComfyNodeDef): Promise<void>
}
