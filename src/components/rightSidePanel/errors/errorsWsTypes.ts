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

/**
 * WS execution-error message. Hand-written rather than extending the ingest
 * ExecutionError: the webserver's node ids diverge from the cloud spec's
 * string-only ids.
 */
export interface ExecutionErrorWsMessage {
  prompt_id: string
  timestamp: number
  node_id?: WsNodeId | null
  node_type: string
  executed: WsNodeId[]
  exception_message: string
  exception_type: string
  traceback: string[]
  current_inputs?: unknown
  current_outputs?: unknown
}
