import { describe, expect, it } from 'vitest'

import type { RunOutput, RunState } from './workshop-run'
import {
  IDLE,
  OUTPUT_TTL_MS,
  formatElapsed,
  isExpired,
  runGate,
  transition
} from './workshop-run'

const output: RunOutput = {
  kind: 'image',
  url: 'https://example.com/out.webp',
  fileName: 'out.webp'
}
const running: RunState = { status: 'running', startedAt: 1000 }

describe('run transition', () => {
  it('starts from idle and ignores a second start while running', () => {
    expect(transition(IDLE, { type: 'start', at: 1000 })).toEqual(running)
    expect(transition(running, { type: 'start', at: 2000 })).toBe(running)
  })

  it('completes with an expiry 24h after completion', () => {
    const done = transition(running, {
      type: 'complete',
      at: 5000,
      output,
      creditsUsed: 24,
      nsfw: false
    })
    expect(done).toMatchObject({
      status: 'succeeded',
      creditsUsed: 24,
      expiresAt: 5000 + OUTPUT_TTL_MS
    })
  })

  it('only cancels or fails a run in flight', () => {
    expect(transition(running, { type: 'cancel' })).toEqual({
      status: 'cancelled'
    })
    expect(transition(IDLE, { type: 'cancel' })).toBe(IDLE)
    expect(transition(IDLE, { type: 'fail', reason: 'provider' })).toBe(IDLE)
    expect(transition(running, { type: 'fail', reason: 'rateLimit' })).toEqual({
      status: 'failed',
      reason: 'rateLimit',
      fieldErrors: {}
    })
  })

  it('accepts validation failures before a run starts', () => {
    expect(
      transition(IDLE, {
        type: 'fail',
        reason: 'validation',
        fieldErrors: { prompt: 'required' }
      })
    ).toEqual({
      status: 'failed',
      reason: 'validation',
      fieldErrors: { prompt: 'required' }
    })
  })

  it('resets to idle from any state', () => {
    expect(transition(running, { type: 'reset' })).toBe(IDLE)
  })
})

describe('runGate', () => {
  const base = {
    signedIn: true,
    credits: 100,
    creditsPerRun: 24,
    policyDisabled: false,
    unavailable: false
  }

  it('is ready when signed in with enough credits', () => {
    expect(runGate(base)).toBe('ready')
  })

  it('refuses to run a model whose price is unknown', () => {
    expect(runGate({ ...base, creditsPerRun: undefined })).toBe('unavailable')
  })

  it('asks for sign in before anything account related', () => {
    expect(runGate({ ...base, signedIn: false, credits: 0 })).toBe('signedOut')
  })

  it('prefers the policy block over buying credits', () => {
    expect(runGate({ ...base, policyDisabled: true, credits: 0 })).toBe(
      'policy'
    )
  })

  it('blocks on credits below the per-run price', () => {
    expect(runGate({ ...base, credits: 23 })).toBe('noCredits')
  })

  it('reports an unavailable model regardless of session', () => {
    expect(runGate({ ...base, signedIn: false, unavailable: true })).toBe(
      'unavailable'
    )
  })
})

describe('formatElapsed', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(65_500)).toBe('1:05')
  })
})

describe('runGate for teams and model lifecycles', () => {
  const base = {
    signedIn: true,
    credits: 100,
    creditsPerRun: 24,
    policyDisabled: false,
    unavailable: false
  }

  it('hands a member without credits to the owner instead of checkout', () => {
    expect(runGate({ ...base, credits: 0, role: 'member' })).toBe(
      'memberNoCredits'
    )
    expect(runGate({ ...base, credits: 0, role: 'owner' })).toBe('noCredits')
  })

  it('treats a deprecated model as unavailable', () => {
    expect(runGate({ ...base, modelStatus: 'deprecated' })).toBe('unavailable')
    expect(runGate({ ...base, modelStatus: 'degraded' })).toBe('ready')
  })

  it('expires an output at the end of its ttl', () => {
    const running = transition(IDLE, { type: 'start', at: 1_000 })
    const done = transition(running, {
      type: 'complete',
      at: 2_000,
      output: { kind: 'image', url: 'x', fileName: 'x.webp' },
      creditsUsed: 1,
      nsfw: false,
      ttlMs: 0
    })
    expect(isExpired(done, 2_000)).toBe(true)
    expect(isExpired(running, 2_000)).toBe(false)
  })
})
