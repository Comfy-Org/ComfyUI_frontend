import { z } from 'zod'
import { zNodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { resultItemType } from '@/schemas/resultItemTypeSchema'

const zNodeType = z.string()
const zJobId = z.string()
export type JobId = z.infer<typeof zJobId>

export const zResultItem = z.object({
  filename: z.string().optional(),
  subfolder: z.string().optional(),
  type: resultItemType.optional(),
  display_name: z.string().optional()
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

// WS messages
const zStatusWsMessageStatus = z.object({
  exec_info: z.object({
    queue_remaining: z.number().int()
  })
})

const zStatusWsMessage = z.object({
  status: zStatusWsMessageStatus.nullish(),
  sid: z.string().nullish()
})

const zProgressWsMessage = z.object({
  value: z.number().int(),
  max: z.number().int(),
  prompt_id: zJobId,
  node: zNodeId
})

const zNodeProgressState = z.object({
  value: z.number(),
  max: z.number(),
  state: z.enum(['pending', 'running', 'finished', 'error']),
  node_id: zNodeId,
  prompt_id: zJobId,
  display_node_id: zNodeId.optional(),
  parent_node_id: zNodeId.optional(),
  real_node_id: zNodeId.optional()
})

const zProgressStateWsMessage = z.object({
  prompt_id: zJobId,
  nodes: z.record(zNodeId, zNodeProgressState)
})

const zExecutingWsMessage = z.object({
  node: zNodeId,
  display_node: zNodeId,
  prompt_id: zJobId
})

const zExecutedWsMessage = zExecutingWsMessage.extend({
  output: zOutputs,
  merge: z.boolean().optional()
})

const zExecutionWsMessageBase = z.object({
  prompt_id: zJobId,
  timestamp: z.number().int()
})

const zExecutionStartWsMessage = zExecutionWsMessageBase
const zExecutionSuccessWsMessage = zExecutionWsMessageBase
const zExecutionCachedWsMessage = zExecutionWsMessageBase.extend({
  nodes: z.array(zNodeId)
})
const zExecutionInterruptedWsMessage = zExecutionWsMessageBase.extend({
  node_id: zNodeId,
  node_type: zNodeType,
  executed: z.array(zNodeId)
})
const zExecutionErrorWsMessage = zExecutionWsMessageBase.extend({
  node_id: zNodeId.nullish(),
  node_type: zNodeType,
  executed: z.array(zNodeId),
  exception_message: z.string(),
  exception_type: z.string(),
  traceback: z.array(z.string()),
  current_inputs: z.unknown(),
  current_outputs: z.unknown()
})

const zProgressTextWsMessage = z.object({
  nodeId: zNodeId,
  text: z.string(),
  prompt_id: z.string().optional()
})

const zNotificationWsMessage = z.object({
  value: z.string(),
  id: z.string().optional()
})
const zTerminalSize = z.object({
  cols: z.number(),
  row: z.number()
})
const zLogEntry = z.object({
  t: z.string(),
  m: z.string()
})
const zLogsWsMessage = z.object({
  size: zTerminalSize.optional(),
  entries: z.array(zLogEntry)
})
const zLogRawResponse = z.object({
  size: zTerminalSize,
  entries: z.array(zLogEntry)
})

const zFeatureFlagsWsMessage = z.record(z.string(), z.unknown())

const zAssetDownloadWsMessage = z.object({
  task_id: z.string(),
  asset_name: z.string(),
  bytes_total: z.number(),
  bytes_downloaded: z.number(),
  progress: z.number(),
  status: z.enum(['created', 'running', 'completed', 'failed']),
  asset_id: z.string().optional(),
  error: z.string().optional()
})

const zAssetExportWsMessage = z.object({
  task_id: z.string(),
  export_name: z.string().optional(),
  assets_total: z.number(),
  assets_attempted: z.number(),
  assets_failed: z.number(),
  bytes_total: z.number(),
  bytes_processed: z.number(),
  progress: z.number(),
  status: z.enum(['created', 'running', 'completed', 'failed']),
  error: z.string().optional()
})

export type StatusWsMessageStatus = z.infer<typeof zStatusWsMessageStatus>
export type StatusWsMessage = z.infer<typeof zStatusWsMessage>
export type ProgressWsMessage = z.infer<typeof zProgressWsMessage>
export type ExecutingWsMessage = z.infer<typeof zExecutingWsMessage>
export type ExecutedWsMessage = z.infer<typeof zExecutedWsMessage>
export type ExecutionStartWsMessage = z.infer<typeof zExecutionStartWsMessage>
export type ExecutionSuccessWsMessage = z.infer<
  typeof zExecutionSuccessWsMessage
>
export type ExecutionCachedWsMessage = z.infer<typeof zExecutionCachedWsMessage>
export type ExecutionInterruptedWsMessage = z.infer<
  typeof zExecutionInterruptedWsMessage
>
export type ExecutionErrorWsMessage = z.infer<typeof zExecutionErrorWsMessage>
export type LogsWsMessage = z.infer<typeof zLogsWsMessage>
export type ProgressTextWsMessage = z.infer<typeof zProgressTextWsMessage>
export type NodeProgressState = z.infer<typeof zNodeProgressState>
export type ProgressStateWsMessage = z.infer<typeof zProgressStateWsMessage>
export type FeatureFlagsWsMessage = z.infer<typeof zFeatureFlagsWsMessage>
export type AssetDownloadWsMessage = z.infer<typeof zAssetDownloadWsMessage>
export type AssetExportWsMessage = z.infer<typeof zAssetExportWsMessage>
// End of ws messages

export type NotificationWsMessage = z.infer<typeof zNotificationWsMessage>

export const zTaskOutput = z.record(zNodeId, zOutputs)
export type TaskOutput = z.infer<typeof zTaskOutput>

export type TerminalSize = z.infer<typeof zTerminalSize>
export type LogEntry = z.infer<typeof zLogEntry>
export type LogsRawResponse = z.infer<typeof zLogRawResponse>
