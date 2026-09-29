import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { AgentSendFailure } from '@/platform/telemetry/types'

import { zAgentAdmissionError } from '../schemas/agentApiSchema'
import { AgentApiError } from '../services/agent/agentRestClient'

import { classifyAgentSendError, sendNotDispatched } from './agentSendFailure'

function admission(
  reason: 'no_funds' | 'manual_block' | 'funds_unavailable',
  status: number
): AgentApiError {
  const body = zAgentAdmissionError.parse({
    error: {
      message: 'declined',
      reason,
      type:
        reason === 'funds_unavailable'
          ? 'SERVICE_UNAVAILABLE'
          : 'PAYMENT_REQUIRED'
    }
  })
  return new AgentApiError('declined', status, body)
}

/** What the turn schema actually throws when the ack body is the wrong shape. */
function schemaError(): unknown {
  const result = z.object({ thread_id: z.string() }).safeParse({})
  return result.success ? undefined : result.error
}

describe('classifyAgentSendError', () => {
  it.for([
    {
      name: 'a credit refusal',
      error: () => admission('no_funds', 402),
      expected: {
        stage: 'refused',
        reason: 'admission_denied',
        http_status: 402,
        admission_reason: 'no_funds'
      }
    },
    {
      name: 'a billing outage',
      error: () => admission('funds_unavailable', 503),
      expected: {
        stage: 'refused',
        reason: 'admission_denied',
        http_status: 503,
        admission_reason: 'funds_unavailable'
      }
    },
    {
      name: 'a blocked workspace',
      error: () => admission('manual_block', 402),
      expected: {
        stage: 'refused',
        reason: 'admission_denied',
        http_status: 402,
        admission_reason: 'manual_block'
      }
    },
    {
      // The server-side flag miss gc-7 named: ingest hides the feature behind a
      // 404, so the status is the only evidence the send was refused at all.
      name: 'a server-side flag miss',
      error: () => new AgentApiError('not found', 404, { error: 'not found' }),
      expected: {
        stage: 'refused',
        reason: 'http_error',
        http_status: 404,
        admission_reason: null
      }
    },
    {
      name: 'a single-active-turn conflict',
      error: () => new AgentApiError('conflict', 409, undefined),
      expected: {
        stage: 'refused',
        reason: 'http_error',
        http_status: 409,
        admission_reason: null
      }
    },
    {
      name: 'an agent service outage',
      error: () => new AgentApiError('unavailable', 502, undefined),
      expected: {
        stage: 'refused',
        reason: 'http_error',
        http_status: 502,
        admission_reason: null
      }
    },
    {
      // A 402 whose body does not parse is still a refusal; it just cannot be
      // attributed to the admission gate's reason.
      name: 'a 402 with no admission body',
      error: () =>
        new AgentApiError('payment required', 402, {
          error: { message: 'payment required', type: 'PAYMENT_REQUIRED' }
        }),
      expected: {
        stage: 'refused',
        reason: 'http_error',
        http_status: 402,
        admission_reason: null
      }
    },
    {
      name: 'an admission body on the wrong status',
      error: () => admission('no_funds', 500),
      expected: {
        stage: 'refused',
        reason: 'http_error',
        http_status: 500,
        admission_reason: null
      }
    },
    {
      name: 'a request the browser could not complete',
      error: () => new TypeError('Failed to fetch'),
      expected: {
        stage: 'no_response',
        reason: 'network_error',
        http_status: null,
        admission_reason: null
      }
    },
    {
      name: "the api layer's own response deadline",
      error: () => new DOMException('Fetch timeout', 'TimeoutError'),
      expected: {
        stage: 'no_response',
        reason: 'timeout',
        http_status: null,
        admission_reason: null
      }
    },
    {
      name: 'a cancelled request',
      error: () => new DOMException('Aborted', 'AbortError'),
      expected: {
        stage: 'no_response',
        reason: 'aborted',
        http_status: null,
        admission_reason: null
      }
    },
    {
      // Kept out of network_error on purpose: a bug on the send path must not
      // read as connectivity.
      name: 'an unexpected throw on the send path',
      error: () => new RangeError('bad index'),
      expected: {
        stage: 'no_response',
        reason: 'unknown',
        http_status: null,
        admission_reason: null
      }
    },
    {
      name: 'a non-error rejection',
      error: () => 'nope',
      expected: {
        stage: 'no_response',
        reason: 'unknown',
        http_status: null,
        admission_reason: null
      }
    },
    {
      name: 'an acknowledgement that does not match the schema',
      error: schemaError,
      expected: {
        stage: 'unreadable_response',
        reason: 'malformed_body',
        http_status: null,
        admission_reason: null
      }
    },
    {
      name: 'an acknowledgement that is not json',
      error: () => new SyntaxError('Unexpected token < in JSON'),
      expected: {
        stage: 'unreadable_response',
        reason: 'malformed_body',
        http_status: null,
        admission_reason: null
      }
    }
  ])('classifies $name', ({ error, expected }) => {
    expect(classifyAgentSendError(error())).toEqual(expected)
  })
})

describe('sendNotDispatched', () => {
  it.for(['send_in_flight', 'target_changed', 'session_reset'] as const)(
    'reports %s with no status, because no request was issued',
    (reason) => {
      const expected: AgentSendFailure = {
        stage: 'not_dispatched',
        reason,
        http_status: null,
        admission_reason: null
      }
      expect(sendNotDispatched(reason)).toEqual(expected)
    }
  )
})
