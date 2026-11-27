import type {
  ExecutedWsMessage,
  ExecutionErrorWsMessage
} from '@comfyorg/api-client/executionTypes'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import type { WorkflowQueueIntent } from '@comfyorg/telemetry/types'

export interface LegacyQueueApp {
  readonly lastExecutionError: ExecutionErrorWsMessage | null
  loadGraphData(
    graphData?: ComfyWorkflowJSON,
    clean?: boolean,
    restore_view?: boolean,
    workflow?: string | null,
    options?: { initiator?: 'user' }
  ): Promise<unknown>
  queuePrompt(
    number: number,
    batchCount?: number,
    options?: { intent?: WorkflowQueueIntent }
  ): Promise<boolean>
}

export interface LegacyQueueHost {
  restoreOutputs(
    outputs: Partial<Record<string, ExecutedWsMessage['output']>>
  ): void
}
