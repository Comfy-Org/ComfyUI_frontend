import type {
  AgentSendFailure,
  AgentSendNoResponseReason,
  AgentSendNotDispatchedReason
} from '@/platform/telemetry/types'

import { zAgentAdmissionError } from '../schemas/agentApiSchema'
import { AgentApiError } from '../services/agent/agentRestClient'

export function parseAdmissionError(error: unknown) {
  if (!(error instanceof AgentApiError)) return undefined
  const parsed = zAgentAdmissionError.safeParse(error.body)
  if (!parsed.success) return undefined
  const expectedStatus =
    parsed.data.error.type === 'PAYMENT_REQUIRED' ? 402 : 503
  if (error.status !== expectedStatus) return undefined
  return { ...parsed.data.error, retryAfterSeconds: error.retryAfterSeconds }
}

export function sendNotDispatched(
  reason: AgentSendNotDispatchedReason
): AgentSendFailure {
  return {
    stage: 'not_dispatched',
    reason,
    http_status: null,
    admission_reason: null
  }
}

/**
 * Errors are matched on `name`, never on class identity: the response schema
 * comes from `@comfyorg/ingest-types`, which declares its own zod dependency, so
 * a second copy of zod in the tree would make `instanceof ZodError` silently
 * false and reclassify a parse failure as a network one.
 */
function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined
}

/**
 * Zod and `Response.json()` both reject only after the status line was read and
 * found ok, so these are the two throws that mean "the turn may well have
 * started and the client cannot tell".
 */
function isUnreadableResponse(error: unknown): boolean {
  const name = errorName(error)
  return name === 'ZodError' || name === 'SyntaxError'
}

function noResponseReason(error: unknown): AgentSendNoResponseReason {
  const name = errorName(error)
  if (name === 'TimeoutError') return 'timeout'
  if (name === 'AbortError') return 'aborted'
  return name === 'TypeError' ? 'network_error' : 'unknown'
}

/**
 * The turn POST rejected. Only an `AgentApiError` proves a status line came
 * back, so every other throw is classified from what it says about itself
 * rather than assumed to be the network.
 */
export function classifyAgentSendError(error: unknown): AgentSendFailure {
  if (error instanceof AgentApiError) {
    const admission = parseAdmissionError(error)
    return {
      stage: 'refused',
      reason: admission === undefined ? 'http_error' : 'admission_denied',
      http_status: error.status,
      admission_reason: admission?.reason ?? null
    }
  }
  if (isUnreadableResponse(error))
    return {
      stage: 'unreadable_response',
      reason: 'malformed_body',
      http_status: null,
      admission_reason: null
    }
  return {
    stage: 'no_response',
    reason: noResponseReason(error),
    http_status: null,
    admission_reason: null
  }
}
