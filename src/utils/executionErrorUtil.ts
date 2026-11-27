import type { NodeError, PromptError } from '@comfyorg/api-client/types'
import type { SerializedNodeId } from '@comfyorg/graph-model/nodeId'
import type { ExecutionErrorWsMessage } from '@comfyorg/api-client/executionTypes'
import { zRelayedNodeErrors } from '@comfyorg/api-client/executionTypes'
import type { zPromptOutputsSkippedNodeError } from '@comfyorg/ingest-types/zod'
import { isPlainObject } from 'es-toolkit'
import type { z } from 'zod'

type PromptOutputsSkippedNodeError = z.infer<
  typeof zPromptOutputsSkippedNodeError
>

type RawPromptError =
  | string
  | { type?: string; message?: string; details?: string }

/**
 * The standard prompt validation response shape (`{ error, node_errors }`).
 * In cloud, this is embedded as JSON inside `execution_error.exception_message`
 * because prompts are queued asynchronously and errors arrive via WebSocket
 * rather than as direct HTTP responses.
 */
interface CloudValidationError {
  error?: RawPromptError
  node_errors?: Record<SerializedNodeId, NodeError>
}

export function isCloudValidationError(
  value: unknown
): value is CloudValidationError {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('error' in value || 'node_errors' in value)
  )
}

/**
 * Extracts a prompt validation response embedded in an exception message string.
 *
 * Cloud example `exception_message`:
 *   "Failed to send prompt request: ... 400: {\"error\":{...},\"node_errors\":{...}}"
 *
 * This function finds the first '{' and parses the trailing JSON.
 */
export function tryExtractValidationError(
  exceptionMessage: string
): CloudValidationError | null {
  const jsonStart = exceptionMessage.indexOf('{')
  const jsonEnd = exceptionMessage.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) return null

  try {
    const parsed: unknown = JSON.parse(
      exceptionMessage.substring(jsonStart, jsonEnd + 1)
    )
    return isCloudValidationError(parsed) ? parsed : null
  } catch {
    return null
  }
}

type CloudValidationResult =
  | { kind: 'nodeErrors'; nodeErrors: Record<SerializedNodeId, NodeError> }
  | { kind: 'promptError'; promptError: PromptError }

export function normalizePromptError(error: unknown): PromptError | null {
  if (error !== null && typeof error === 'object') {
    return {
      type:
        'type' in error && typeof error.type === 'string'
          ? error.type
          : 'error',
      message:
        'message' in error && typeof error.message === 'string'
          ? error.message
          : '',
      details:
        'details' in error && typeof error.details === 'string'
          ? error.details
          : ''
    }
  }

  return typeof error === 'string'
    ? { type: 'error', message: error, details: '' }
    : null
}

function isExtraInfo(
  value: unknown
): value is NonNullable<NodeValidationError['extra_info']> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (!('input_name' in value) || typeof value.input_name === 'string')
  )
}

function toNodeValidationErrors(error: unknown): NodeValidationError[] {
  const promptError = normalizePromptError(error)
  if (!promptError) return []
  const extraInfo =
    error !== null && typeof error === 'object' && 'extra_info' in error
      ? error.extra_info
      : undefined
  return [
    isExtraInfo(extraInfo)
      ? { ...promptError, extra_info: extraInfo }
      : promptError
  ]
}

/**
 * Converts relayed node errors to `NodeError`s; a string entry becomes the
 * message, and a node left with no errors is dropped.
 */
export function normalizeRelayedNodeErrors(
  nodeErrors: Record<string, PromptOutputsSkippedNodeError>
): Record<string, NodeError> {
  return Object.fromEntries(
    Object.entries(nodeErrors).flatMap(([nodeId, nodeError]) => {
      const errors = nodeError.errors.flatMap(toNodeValidationErrors)
      return errors.length > 0 ? [[nodeId, { ...nodeError, errors }]] : []
    })
  )
}

export function isMissingNodePromptError(
  promptError: PromptError | null | undefined
): boolean {
  return promptError?.type === 'missing_node_type'
}

function relayedNodeErrorsOf(nodeErrors: unknown): Record<string, NodeError> {
  const parsed = zRelayedNodeErrors.safeParse(nodeErrors)
  return parsed.success ? normalizeRelayedNodeErrors(parsed.data) : {}
}

function usableNodeError(nodeError: NodeError | null): NodeError | null {
  if (!isPlainObject(nodeError) || !Array.isArray(nodeError.errors)) return null
  const errors = nodeError.errors.filter((error) => isPlainObject(error))
  return errors.length > 0 ? { ...nodeError, errors } : null
}

function usableNodeErrors(
  nodeErrors: Record<SerializedNodeId, NodeError | null> | undefined
): Record<SerializedNodeId, NodeError> {
  return Object.fromEntries(
    Object.entries(nodeErrors ?? {}).flatMap(([nodeId, nodeError]) => {
      const usable = usableNodeError(nodeError)
      return usable ? [[nodeId, usable] as const] : []
    })
  )
}

type CloudValidationDetail = Pick<
  ExecutionErrorWsMessage,
  'exception_message'
> &
  Partial<Pick<ExecutionErrorWsMessage, 'exception_type'>> & {
    node_errors?: unknown
  }

function relayedRejection(exceptionMessage: string): CloudValidationError {
  return {
    error: {
      type: 'prompt_outputs_failed_validation',
      message: exceptionMessage,
      details: exceptionMessage
    }
  }
}

function relaysNodeErrors(detail: CloudValidationDetail): boolean {
  return (
    detail.exception_type === 'ValidationError' &&
    isPlainObject(detail.node_errors) &&
    Object.keys(detail.node_errors).length > 0
  )
}

/** The validation response a cloud error carries: its relayed `node_errors` when it sends them, else JSON embedded in its message. */
export function cloudValidationErrorOf(
  detail: CloudValidationDetail
): CloudValidationError | null {
  if (!relaysNodeErrors(detail)) {
    return tryExtractValidationError(detail.exception_message)
  }
  const nodeErrors = relayedNodeErrorsOf(detail.node_errors)
  return Object.keys(nodeErrors).length > 0
    ? { node_errors: nodeErrors }
    : relayedRejection(detail.exception_message)
}

export function classifyCloudValidationError(
  detail: CloudValidationDetail
): CloudValidationResult | null {
  const extracted = cloudValidationErrorOf(detail)
  if (!extracted) return null

  const nodeErrors = usableNodeErrors(extracted.node_errors)
  if (Object.keys(nodeErrors).length > 0) {
    return { kind: 'nodeErrors', nodeErrors }
  }

  const promptError = normalizePromptError(extracted.error)
  return promptError ? { kind: 'promptError', promptError } : null
}

export function errorsForSlot(
  errors: NodeError['errors'],
  slotName: string
): NodeError['errors'] {
  return errors.filter((error) => error.extra_info?.input_name === slotName)
}

export function hasErrorForSlot(
  errors: NodeError['errors'],
  slotName: string
): boolean {
  return errors.some((error) => error.extra_info?.input_name === slotName)
}

/**
 * Error types that can be resolved automatically when the user changes a
 * widget value or establishes a connection, without requiring a re-run.
 *
 * When adding new types, review {@link isValueStillOutOfRange} to ensure
 * the new type does not require range validation before auto-clearing.
 */
export const SIMPLE_ERROR_TYPES = new Set([
  'value_bigger_than_max',
  'value_smaller_than_min',
  'value_not_in_list',
  'required_input_missing'
])

export type NodeValidationError = NodeError['errors'][number]

export const INPUT_LEVEL_VALIDATION_ERROR_TYPES = new Set([
  'required_input_missing',
  'bad_linked_input',
  'return_type_mismatch',
  'invalid_input_type',
  'value_smaller_than_min',
  'value_bigger_than_max',
  'value_not_in_list',
  'custom_validation_failed',
  'exception_during_inner_validation'
])

export const NODE_LEVEL_VALIDATION_ERROR_TYPES = new Set([
  'PARTNER_NODE_DISABLED',
  'exception_during_validation',
  'dependency_cycle'
])

/** Decodes the `[type, { min, max, ... }]` tuple the backend attaches to range errors. */
export function getInputConfigBounds(error: NodeValidationError): {
  min?: unknown
  max?: unknown
} {
  const config = error.extra_info?.input_config
  if (!Array.isArray(config)) return {}

  const bounds = config[1]
  if (!bounds || typeof bounds !== 'object') return {}

  const { min, max } = bounds as { min?: unknown; max?: unknown }
  return { min, max }
}

export function isImageNotLoadedValidationError(
  error: NodeValidationError
): boolean {
  return (
    error.type === 'custom_validation_failed' &&
    /invalid image file|\[errno 21\].*is a directory/i.test(
      [error.message, error.details].filter(Boolean).join('\n')
    )
  )
}

// Anything not input-level (including unknown types) is node-level.
export function isNodeLevelValidationError(
  error: NodeValidationError
): boolean {
  return (
    !INPUT_LEVEL_VALIDATION_ERROR_TYPES.has(error.type) ||
    isImageNotLoadedValidationError(error)
  )
}

/**
 * Returns true if `value` still violates a recorded range constraint.
 * Pass errors already filtered to the target widget (by `input_name`).
 * `options` should contain the widget's configured `min` / `max`.
 *
 * Returns true (keeps the error) when a bound is unknown (`undefined`).
 */
export function isValueStillOutOfRange(
  value: number,
  errors: NodeError['errors'],
  options: { min?: number; max?: number }
): boolean {
  const hasMaxError = errors.some((e) => e.type === 'value_bigger_than_max')
  const hasMinError = errors.some((e) => e.type === 'value_smaller_than_min')

  return (
    (hasMaxError && (options.max === undefined || value > options.max)) ||
    (hasMinError && (options.min === undefined || value < options.min))
  )
}
