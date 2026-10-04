import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  AGENT_REQUEST_ERROR_NAMES,
  AGENT_REQUEST_PATHS,
  agentRequestFailureFingerprint,
  agentRequestPath,
  describeAgentRequestFailure,
  rememberAgentRequestFailure
} from './agentRequestFailure'
import { AgentApiError, AgentResponseUnreadableError } from './agentRestClient'

function zodError(): z.ZodError {
  const parsed = z.object({ threads: z.array(z.unknown()) }).safeParse({})
  if (parsed.success) throw new Error('fixture should not parse')
  return parsed.error
}

/** Attributes `error` to `route` the way `request()` does, then describes it. */
function describeFrom(route: string, error: unknown) {
  return describeAgentRequestFailure(rememberAgentRequestFailure(error, route))
}

describe('agentRequestPath', () => {
  it.for([
    ['/agent/threads', '/agent/threads'],
    ['/agent/threads/th-0bc1f9/messages', '/agent/threads/{threadId}/messages'],
    [
      '/agent/threads/th-0bc1f9/messages/msg-77/cancel',
      '/agent/threads/{threadId}/messages/{messageId}/cancel'
    ],
    [
      '/agent/threads/th-0bc1f9/asks/ask-2/answer',
      '/agent/threads/{threadId}/asks/{askId}/answer'
    ],
    ['/agent/run-mode', '/agent/run-mode'],
    ['/workflows?limit=100&after=cursor-9', '/workflows'],
    ['/upload/image', '/upload/image']
  ] as const)('templates %s as %s', ([route, expected]) => {
    expect(agentRequestPath(route)).toBe(expected)
  })

  it('templates a thread id that needed encoding', () => {
    expect(agentRequestPath('/agent/threads/a%2Fb/messages')).toBe(
      '/agent/threads/{threadId}/messages'
    )
  })

  it.for([
    ['an endpoint not on the allowlist', '/agent/threads/th-1/unknown'],
    ['a route with the wrong arity', '/agent/threads/th-1'],
    ['a foreign route', '/prompt'],
    ['an empty route', '']
  ] as const)('falls back to /other for %s', ([, route]) => {
    expect(agentRequestPath(route)).toBe('/other')
  })

  it('never returns a value outside the allowlist', () => {
    // The privacy property, asserted rather than assumed. A new endpoint loses
    // its label; it does not leak a raw path.
    for (const route of [
      '/agent/threads/user@example.com/messages/secret/forward',
      '/agent/billing/card-4242',
      '/agent/threads?token=abc'
    ]) {
      expect(AGENT_REQUEST_PATHS).toContain(agentRequestPath(route))
    }
  })
})

describe('describeAgentRequestFailure', () => {
  it('carries the status and the route of a server refusal', () => {
    expect(
      describeFrom('/agent/threads', new AgentApiError('', 401, undefined))
    ).toEqual({
      request_path: '/agent/threads',
      request_status: 401,
      request_error: 'AgentApiError'
    })
  })

  it.for([
    [
      'a 2xx body that is not JSON',
      new AgentResponseUnreadableError(new SyntaxError('Unexpected token <')),
      'AgentResponseUnreadableError'
    ],
    ['a 2xx body of the wrong shape', zodError(), 'ZodError'],
    [
      'the header deadline',
      new DOMException('Fetch timeout', 'TimeoutError'),
      'TimeoutError'
    ],
    [
      'caller cancellation',
      new DOMException('Aborted', 'AbortError'),
      'AbortError'
    ],
    [
      'a request that never arrived',
      new TypeError('Failed to fetch'),
      'TypeError'
    ]
  ] as const)(
    'names %s without inventing a status',
    ([, error, expectedName]) => {
      const diagnostics = describeFrom(
        '/agent/threads/th-0bc1f9/messages',
        error
      )

      expect(diagnostics).toEqual({
        request_path: '/agent/threads/{threadId}/messages',
        request_error: expectedName
      })
      // An absent status must stay absent: a 0 here would read as a real status
      // in a PostHog breakdown.
      expect('request_status' in diagnostics).toBe(false)
    }
  )

  it('omits the route when the failure did not come from a request', () => {
    // `hydrateFromServer` wraps `getMessages`, `hydrate` and
    // `workflow.restored` in one `catch`, so an unattributed failure is a real
    // outcome. Reporting no route beats reporting a wrong one — production
    // already shows `/agent/run-mode` failures landing under
    // `agent_history_load_failed`.
    const diagnostics = describeAgentRequestFailure(
      new Error('hydrate threw after the response arrived')
    )

    expect(diagnostics).toEqual({ request_error: 'other' })
    expect('request_path' in diagnostics).toBe(false)
  })

  it('attributes each concurrent failure to its own route', () => {
    const list = rememberAgentRequestFailure(
      new AgentApiError('', 500, undefined),
      '/agent/threads'
    )
    const history = rememberAgentRequestFailure(
      new AgentApiError('', 500, undefined),
      '/agent/threads/th-1/messages'
    )

    expect(describeAgentRequestFailure(list).request_path).toBe(
      '/agent/threads'
    )
    expect(describeAgentRequestFailure(history).request_path).toBe(
      '/agent/threads/{threadId}/messages'
    )
  })

  it.for([
    [
      'an unrecognised DOMException',
      new DOMException('nope', 'DataCloneError')
    ],
    ['a bare error', new Error('boom')],
    ['a thrown string', 'boom']
  ] as const)('falls back to `other` for %s', ([, error]) => {
    expect(describeFrom('/agent/threads', error).request_error).toBe('other')
  })

  it('reports nothing outside the closed vocabularies', () => {
    const hostile = Object.assign(new Error('user@example.com asked for X'), {
      name: 'th-0bc1f9/user@example.com',
      status: 403
    })

    const diagnostics = describeFrom('/agent/threads', hostile)

    expect(AGENT_REQUEST_ERROR_NAMES).toContain(diagnostics.request_error)
    expect(diagnostics).toEqual({
      request_path: '/agent/threads',
      request_error: 'other'
    })
  })

  it('keeps the thread id out of the history route it describes', () => {
    // #19740 removed routes and ids from the error message for this reason
    // (PM-1903); the template is how the route survives without the id.
    expect(
      JSON.stringify(
        describeFrom(
          '/agent/threads/th-0bc1f9/messages',
          new AgentApiError('thread th-0bc1f9 not found', 404, {
            error: 'thread th-0bc1f9 not found'
          })
        )
      )
    ).not.toContain('th-0bc1f9')
  })

  it('does not alter the error it describes', () => {
    // `isRetryableRequestFailure` and `handleHistoryLoadError` both branch on
    // `instanceof` and on `status`, so attribution has to be a side channel.
    const error = new AgentApiError('gone', 404, undefined)

    const returned = rememberAgentRequestFailure(error, '/agent/threads')

    expect(returned).toBe(error)
    expect(error).toBeInstanceOf(AgentApiError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('gone')
  })
})

describe('agentRequestFailureFingerprint', () => {
  it('separates the two load failures from each other', () => {
    const threadList = agentRequestFailureFingerprint(
      'agent_thread_list_load_failed',
      describeFrom('/agent/threads', new AgentApiError('', 500, undefined))
    )
    const history = agentRequestFailureFingerprint(
      'agent_history_load_failed',
      describeFrom(
        '/agent/threads/th-1/messages',
        new AgentApiError('', 500, undefined)
      )
    )

    expect(threadList).not.toEqual(history)
  })

  it('separates failure modes but not statuses', () => {
    const diagnose = (error: unknown) =>
      agentRequestFailureFingerprint(
        'agent_thread_list_load_failed',
        describeFrom('/agent/threads', error)
      )

    // One issue per failure mode, with the status as a tag facet inside it:
    // splitting per status would scatter one problem across a dozen issues and
    // make it un-alertable again.
    expect(diagnose(new AgentApiError('', 401, undefined))).toEqual(
      diagnose(new AgentApiError('', 503, undefined))
    )
    expect(diagnose(new AgentApiError('', 503, undefined))).not.toEqual(
      diagnose(new TypeError('Failed to fetch'))
    )
  })

  it('still groups a failure it could not attribute to a route', () => {
    expect(
      agentRequestFailureFingerprint(
        'agent_history_load_failed',
        describeAgentRequestFailure(new Error('boom'))
      )
    ).toEqual([
      'agent-request-failure',
      'agent_history_load_failed',
      'unattributed',
      'other'
    ])
  })

  it('is bounded and free of request detail', () => {
    expect(
      agentRequestFailureFingerprint(
        'agent_history_load_failed',
        describeFrom(
          '/agent/threads/th-0bc1f9/messages',
          new AgentApiError('thread th-0bc1f9 not found', 404, {
            error: 'thread th-0bc1f9 not found'
          })
        )
      )
    ).toEqual([
      'agent-request-failure',
      'agent_history_load_failed',
      '/agent/threads/{threadId}/messages',
      'AgentApiError'
    ])
  })
})
