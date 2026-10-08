import { describe, expect, it } from 'vitest'

import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { ReshootError } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import type { SwapGateFacts } from './swap-rules'
import {
  canSwap,
  missingInput,
  quoteFailure,
  quoteRefusesCredit,
  swapFailureNote,
  swapFailureReason,
  swapGate
} from './swap-rules'

const signedIn: SwapGateFacts = {
  noAccount: false,
  unavailable: false,
  mounted: true,
  authEnabled: true,
  sessionFailed: false,
  sessionSettled: true,
  hasUser: true,
  hasSession: true,
  role: 'owner',
  refusesCredit: false
}

const quote = (patch: Partial<ReshootQuote> = {}): ReshootQuote => ({
  free_runs_remaining: 3,
  price_credits: 60,
  next_run: 'free',
  ...patch
})

describe('swapGate', () => {
  it.for<[string, Partial<SwapGateFacts>, string]>([
    ['a signed-in owner', {}, 'ready'],
    ['a page not yet mounted', { mounted: false }, 'pending'],
    [
      'a session still being minted',
      { hasSession: false, role: undefined },
      'pending'
    ],
    [
      'nobody signed in',
      { hasUser: false, hasSession: false, role: undefined },
      'signedOut'
    ],
    ['an owner out of credits', { refusesCredit: true }, 'noCredits'],
    [
      'a member out of credits',
      { role: 'member', refusesCredit: true },
      'memberNoCredits'
    ],
    ['no backend', { unavailable: true }, 'unavailable'],
    ['sign-in switched off', { authEnabled: false }, 'unavailable'],
    ['a failed session', { sessionFailed: true }, 'unavailable']
  ])('offers %s the right thing', ([, patch, gate]) => {
    expect(swapGate({ ...signedIn, ...patch })).toBe(gate)
  })

  it.for<[string, Partial<SwapGateFacts>, string]>([
    ['is ready with nobody signed in', {}, 'ready'],
    ['waits for the page to mount', { mounted: false }, 'pending'],
    ['still honours a credit refusal', { refusesCredit: true }, 'noCredits'],
    [
      'falls back to the account rules when the backend is gone',
      { unavailable: true },
      'unavailable'
    ]
  ])('a backend that needs no account %s', ([, patch, gate]) => {
    const local: SwapGateFacts = {
      ...signedIn,
      noAccount: true,
      hasUser: false,
      hasSession: false,
      role: undefined
    }
    expect(swapGate({ ...local, ...patch })).toBe(gate)
  })
})

describe('quoteRefusesCredit', () => {
  it('is a blocked quote for lack of credits, but not while a take renders', () => {
    const blocked = quote({
      next_run: 'blocked',
      blocked_reason: 'insufficient_credits'
    })
    expect(quoteRefusesCredit(false, blocked)).toBe(true)
    expect(quoteRefusesCredit(true, blocked)).toBe(false)
    expect(quoteRefusesCredit(false, quote())).toBe(false)
    expect(quoteRefusesCredit(false, undefined)).toBe(false)
  })
})

describe('missingInput', () => {
  it.for<[boolean, boolean, string, string | undefined]>([
    [false, false, '', 'video'],
    [true, false, 'the man', 'character'],
    [true, true, '   ', 'target'],
    [true, true, 'the man', undefined]
  ])(
    'asks in the panel order: %s %s "%s" -> %s',
    ([video, character, target, missing]) => {
      expect(missingInput({ video, character, target })).toBe(missing)
    }
  )
})

describe('canSwap', () => {
  const ready = {
    gate: 'ready',
    missing: undefined,
    rendering: false,
    quoteSettled: true,
    quote: quote()
  } as const

  it('lets a run start when nothing stands in the way', () => {
    expect(canSwap(ready)).toBe(true)
  })

  it('also runs where nothing is metered and the quote is empty', () => {
    expect(canSwap({ ...ready, quote: undefined })).toBe(true)
  })

  it.for<[string, Partial<Parameters<typeof canSwap>[0]>]>([
    ['the gate is not ready', { gate: 'signedOut' }],
    ['an input is missing', { missing: 'target' }],
    ['a take is rendering', { rendering: true }],
    ['the price is not known yet', { quoteSettled: false }],
    ['the quote blocks the run', { quote: quote({ next_run: 'blocked' }) }]
  ])('holds a run back while %s', ([, patch]) => {
    expect(canSwap({ ...ready, ...patch })).toBe(false)
  })
})

describe('quoteFailure', () => {
  it('asks again later and later after an ordinary failure', () => {
    const waits = [0, 1, 2, 3, 9].map(
      (failures) => quoteFailure(new Error('offline'), failures).retryInMs
    )
    expect(waits).toEqual([5_000, 15_000, 30_000, 60_000, 60_000])
  })

  it.for<[string, boolean]>([
    ['app_unavailable', true],
    ['not_found', true],
    ['unauthorized', false]
  ])(
    'stops asking after %s, and knows whether the app is gone: %s',
    ([code, unavailable]) => {
      expect(quoteFailure(new ReshootError(code), 0)).toEqual({
        unavailable,
        retryInMs: undefined
      })
    }
  )
})

describe('swapFailureNote', () => {
  const context = { locale: 'en', workspace: 'Studio' } as const

  it.for<[string, string]>([
    [
      'app_unavailable',
      'Openjutsu is not available right now. Try again later.'
    ],
    ['not_found', 'Openjutsu is not available right now. Try again later.'],
    ['unauthorized', 'Sign in to run a swap.'],
    [
      'job_failed',
      'The swap did not finish. Try again, or try a shorter part.'
    ],
    ['concurrent_run_limit', 'One take at a time: wait for this one to finish.']
  ])('explains %s', ([code, note]) => {
    expect(swapFailureNote(new ReshootError(code), context)).toBe(note)
  })

  it('tells an owner and a member apart when credits run out', () => {
    const error = new ReshootError('insufficient_credits')
    const owner = swapFailureNote(error, { ...context, role: 'owner' })
    const member = swapFailureNote(error, { ...context, role: 'member' })
    expect(owner).not.toBe(member)
    expect(member).toContain('Studio')
  })

  it('falls back to a plain line for anything it does not know', () => {
    expect(swapFailureNote(new Error('boom'), context)).toBe(
      'Something went wrong. Try again.'
    )
  })
})

describe('swapFailureReason', () => {
  it('counts a backend refusal apart from a fault in the page', () => {
    expect(swapFailureReason(new ReshootError('job_failed'))).toBe('provider')
    expect(swapFailureReason(new TypeError('boom'))).toBe('client')
  })
})
