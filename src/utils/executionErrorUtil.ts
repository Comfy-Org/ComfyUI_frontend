import type { NodeError, PromptError } from '@/schemas/apiSchema'
import type { SerializedNodeId } from '@/types/nodeId'

/**
 * The standard prompt validation response shape (`{ error, node_errors }`).
 * In cloud, this is embedded as JSON inside `execution_error.exception_message`
 * because prompts are queued asynchronously and errors arrive via WebSocket
 * rather than as direct HTTP responses.
 */
interface CloudValidationError {
  error?: { type?: string; message?: string; details?: string } | string
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

/**
 * Classifies an embedded cloud validation error from `exception_message`
 * as either node-level errors or a prompt-level error.
 *
 * Returns `null` if the message does not contain a recognizable validation error.
 */
export function classifyCloudValidationError(
  exceptionMessage: string
): CloudValidationResult | null {
  const extracted = tryExtractValidationError(exceptionMessage)
  if (!extracted) return null

  const { error, node_errors } = extracted
  const hasNodeErrors = node_errors && Object.keys(node_errors).length > 0

  if (hasNodeErrors) {
    return { kind: 'nodeErrors', nodeErrors: node_errors }
  }

  if (error && typeof error === 'object') {
    return {
      kind: 'promptError',
      promptError: {
        type: error.type ?? 'error',
        message: error.message ?? '',
        details: error.details ?? ''
      }
    }
  }

  if (typeof error === 'string') {
    return {
      kind: 'promptError',
      promptError: { type: 'error', message: error, details: '' }
    }
  }

  return null
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
