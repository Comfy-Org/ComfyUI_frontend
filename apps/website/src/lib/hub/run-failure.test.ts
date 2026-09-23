import { describe, expect, it } from 'vitest'

import { failureAction, workflowFailure } from './run-failure'

describe('workflowFailure', () => {
  // The refusals Cloud's prompt API documents, each at the code it documents
  // it at. A reader is told a different thing for each, so reading one as
  // another is a wrong instruction, not a wrong word.
  it.for([
    { status: 401, type: undefined, reason: 'signedOut' },
    { status: 402, type: undefined, reason: 'noCredits' },
    { status: 403, type: 'PARTNER_NODE_DISABLED', reason: 'policy' },
    { status: 400, type: undefined, reason: 'validation' },
    { status: 422, type: undefined, reason: 'validation' },
    { status: 413, type: undefined, reason: 'client' },
    { status: 500, type: undefined, reason: 'provider' },
    { status: 503, type: undefined, reason: 'unavailable' }
  ] as const)('reads $status as $reason', ({ status, type, reason }) => {
    expect(workflowFailure(status, type)).toBe(reason)
  })

  // One code, two unrelated things: a queue that empties on its own, and a
  // bill that never does. Only the body's type tells them apart.
  it.for([
    { type: 'QUEUE_LIMIT', reason: 'concurrency' },
    { type: 'PAYMENT_REQUIRED', reason: 'noCredits' },
    { type: 'FREE_TIER_EXHAUSTED', reason: 'noCredits' },
    { type: 'FREE_TIER_UNAVAILABLE', reason: 'noCredits' },
    { type: 'PARTNER_NODE_PAYMENT_REQUIRED', reason: 'noCredits' },
    { type: undefined, reason: 'rateLimit' }
  ] as const)('reads a 429 of $type as $reason', ({ type, reason }) => {
    expect(workflowFailure(429, type)).toBe(reason)
  })

  it('reads a billing gate as one whatever code it arrives under', () => {
    expect(workflowFailure(503, 'PAYMENT_REQUIRED')).toBe('noCredits')
  })
})

describe('failureAction', () => {
  // The whole point of naming a failure is that the way out differs. Nothing
  // is offered where nothing the reader does would change the answer.
  it.for([
    { failure: 'noCredits', member: false, action: 'credits' },
    { failure: 'noCredits', member: true, action: 'personal' },
    { failure: 'signedOut', member: false, action: 'signIn' },
    { failure: 'policy', member: false, action: 'none' },
    { failure: 'validation', member: false, action: 'none' },
    { failure: 'client', member: false, action: 'none' },
    { failure: 'rateLimit', member: false, action: 'retry' },
    { failure: 'concurrency', member: false, action: 'retry' },
    { failure: 'provider', member: false, action: 'retry' },
    { failure: 'timeout', member: false, action: 'retry' },
    { failure: 'unavailable', member: false, action: 'retry' },
    { failure: 'network', member: false, action: 'retry' },
    { failure: 'upload', member: false, action: 'retry' }
  ] as const)('offers $action for $failure', ({ failure, member, action }) => {
    expect(failureAction(failure, member)).toBe(action)
  })
})
