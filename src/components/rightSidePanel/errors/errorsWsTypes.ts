import type { ExecutionError } from '@comfyorg/ingest-types'

import type { NodeValidationError } from '@/utils/executionErrorUtil'

/** The webserver sends node ids in either form; the cloud ingest spec narrows to string. */
type WsNodeId = string | number

/** Prompt validation error — webserver-specific, no ingest-types equivalent. */
export interface PromptError {
  type: string
  message: string
  details: string
}

/** Node validation error record — webserver-specific, no ingest-types equivalent. */
export interface NodeError {
  errors: NodeValidationError[]
  class_type: string
  dependent_outputs: unknown[]
}

export interface ExecutionErrorWsMessage extends Pick<
  ExecutionError,
  'node_type' | 'exception_message' | 'exception_type' | 'traceback'
> {
  prompt_id: string
  timestamp: number
  node_id?: WsNodeId | null
  executed: WsNodeId[]
  current_inputs?: unknown
  current_outputs?: unknown
}
