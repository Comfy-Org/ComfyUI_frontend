export const CUSTOM_NODE_LOAD_ERROR_TYPE = 'error_loading_extension'
export const CUSTOM_NODE_FAILURES_TRUNCATED_FIELD = 'failures_truncated'

export interface CustomNodeFailureDiagnostic {
  ext: string
  message: string
  stack?: string
}

export function getCustomNodeFailureSignals(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []

  return [
    'ext' in value && typeof value.ext === 'string' ? value.ext : undefined,
    'stack' in value && typeof value.stack === 'string'
      ? value.stack
      : undefined
  ].filter((signal): signal is string => signal !== undefined)
}
