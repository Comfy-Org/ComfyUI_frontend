import type { PromptInfo } from '@comfyorg/ingest-types'
import { z } from 'zod'
import { zNodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { resultItemType } from '@/schemas/resultItemTypeSchema'

export type JobId = string

export const zResultItem = z.object({
  filename: z.string().optional(),
  subfolder: z.string().optional(),
  type: resultItemType.optional(),
  display_name: z.string().optional(),
  id: z.string().optional()
})
export type ResultItem = z.infer<typeof zResultItem>
// Uses .passthrough() because custom nodes can output arbitrary keys.
// See docs/adr/NODE-OUTPUTS-0007-output-passthrough-for-extensible-nodes.md
const zOutputs = z
  .object({
    audio: z.array(zResultItem).optional(),
    images: z.array(zResultItem).optional(),
    video: z.array(zResultItem).optional(),
    animated: z.array(z.boolean()).optional(),
    text: z.union([z.string(), z.array(z.string())]).optional()
  })
  .passthrough()

export type NodeExecutionOutput = z.infer<typeof zOutputs>

export type NodeOutputWith<T extends Record<string, unknown>> =
  NodeExecutionOutput & T

type NodeId = z.infer<typeof zNodeId>

export type StatusWsMessageStatus = PromptInfo
export interface StatusWsMessage {
  status?: StatusWsMessageStatus | null
  sid?: string | null
}
export interface ProgressWsMessage {
  value: number
  max: number
  prompt_id: JobId
  node: NodeId
}
export interface NodeProgressState {
  value: number
  max: number
  state: 'pending' | 'running' | 'finished' | 'error'
  node_id: NodeId
  prompt_id: JobId
  display_node_id?: NodeId
  parent_node_id?: NodeId
  real_node_id?: NodeId
}
export interface ProgressStateWsMessage {
  prompt_id: JobId
  nodes: Record<NodeId, NodeProgressState>
}
export interface ExecutingWsMessage {
  node: NodeId | null
  display_node?: NodeId
  prompt_id: JobId
}
export interface ExecutedWsMessage extends ExecutingWsMessage {
  node: NodeId
  display_node: NodeId
  output: NodeExecutionOutput
  merge?: boolean
}
interface ExecutionWsMessageBase {
  prompt_id: JobId
  timestamp: number
}
export type ExecutionStartWsMessage = ExecutionWsMessageBase
export type ExecutionSuccessWsMessage = ExecutionWsMessageBase
export interface ExecutionCachedWsMessage extends ExecutionWsMessageBase {
  nodes: NodeId[]
}
export interface ExecutionInterruptedWsMessage extends ExecutionWsMessageBase {
  node_id: NodeId
  node_type: string
  executed: NodeId[]
}
export interface ExecutionErrorWsMessage extends ExecutionWsMessageBase {
  node_id?: NodeId | null
  node_type: string
  executed: NodeId[]
  exception_message: string
  exception_type: string
  traceback: string[]
  current_inputs?: unknown
  current_outputs?: unknown
}
export interface ProgressTextWsMessage {
  nodeId: NodeId
  text: string
  prompt_id?: string
}
export interface NotificationWsMessage {
  value: string
  id?: string
}
export interface TerminalSize {
  cols: number
  row: number
}
export interface LogEntry {
  t: string
  m: string
}
export interface LogsWsMessage {
  size?: TerminalSize
  entries: LogEntry[]
}
export interface LogsRawResponse {
  size: TerminalSize
  entries: LogEntry[]
}
export type FeatureFlagsWsMessage = Record<string, unknown>
type AssetTaskStatus = 'created' | 'running' | 'completed' | 'failed'
export interface AssetDownloadWsMessage {
  task_id: string
  asset_name: string
  bytes_total: number
  bytes_downloaded: number
  progress: number
  status: AssetTaskStatus
  asset_id?: string
  error?: string
}
export interface AssetExportWsMessage {
  task_id: string
  export_name?: string
  assets_total: number
  assets_attempted: number
  assets_failed: number
  bytes_total: number
  bytes_processed: number
  progress: number
  status: AssetTaskStatus
  error?: string
}

export const zTaskOutput = z.record(zNodeId, zOutputs)
export type TaskOutput = z.infer<typeof zTaskOutput>
