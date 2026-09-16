export interface PromptRejection {
  status: number
  summary?: string
  errorType?: string
}

export interface PromptCapture {
  sequence: number
  promptId?: string
  rejection?: PromptRejection
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function summarizePromptError(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined
  const parts: string[] = []
  const topError = body.error
  if (typeof topError === 'string') {
    if (topError) parts.push(topError)
  } else if (isRecord(topError) && typeof topError.message === 'string')
    parts.push(topError.message)
  if (!isRecord(body.node_errors))
    return parts.length > 0 ? parts.join('; ') : undefined
  for (const [nodeId, nodeError] of Object.entries(body.node_errors)) {
    if (!isRecord(nodeError)) continue
    const cls =
      typeof nodeError.class_type === 'string' ? nodeError.class_type : nodeId
    if (!Array.isArray(nodeError.errors)) continue
    for (const err of nodeError.errors) {
      if (!isRecord(err)) continue
      const detail =
        typeof err.details === 'string' && err.details
          ? err.details
          : typeof err.message === 'string'
            ? err.message
            : undefined
      if (detail) parts.push(`${cls}: ${detail}`)
    }
  }
  return parts.length > 0 ? parts.join('; ') : undefined
}

function extractPromptErrorType(body: unknown): string | undefined {
  if (!isRecord(body) || !isRecord(body.error)) return undefined
  const type = body.error.type
  return typeof type === 'string' && type ? type : undefined
}

export function capturePromptResponse(
  current: PromptCapture,
  response: {
    sequence: number
    status: number
    body: unknown
    promptId?: string
  }
): PromptCapture {
  if (response.sequence < current.sequence) return current
  return {
    sequence: response.sequence,
    promptId: response.promptId,
    rejection:
      response.status >= 400
        ? {
            status: response.status,
            summary: summarizePromptError(response.body),
            errorType: extractPromptErrorType(response.body)
          }
        : undefined
  }
}

export const describePromptRejection = (rejection: PromptRejection): string =>
  rejection.summary ?? `HTTP ${rejection.status} prompt submission failed`

const SERVER_SIDE_FAULT_PREFIX = 'prompt submission failed server-side'

export function isServerSideFault(error: unknown): error is Error {
  return (
    error instanceof Error && error.message.startsWith(SERVER_SIDE_FAULT_PREFIX)
  )
}

export const serverSideFault = (rejection: PromptRejection): Error =>
  new Error(
    `${SERVER_SIDE_FAULT_PREFIX} (HTTP ${rejection.status} POST /prompt)` +
      (rejection.summary ? ` - ${rejection.summary}` : '') +
      (rejection.errorType ? ` [type: ${rejection.errorType}]` : '') +
      ' - backend/environment fault, not a pack validation reject'
  )
