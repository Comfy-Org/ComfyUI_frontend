import { describe, expect, it } from 'vitest'

import type { RunOutput, RunState } from './workshop-run'
import {
  IDLE,
  OUTPUT_TTL_MS,
  formatElapsed,
  isExpired,
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
      nsfw: false
    })
    expect(done).toMatchObject({
      status: 'succeeded',
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

describe('formatElapsed', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(65_500)).toBe('1:05')
  })
})

describe('isExpired', () => {
  it('expires an output at the end of its ttl', () => {
    const running = transition(IDLE, { type: 'start', at: 1_000 })
    const done = transition(running, {
      type: 'complete',
      at: 2_000,
      output: { kind: 'image', url: 'x', fileName: 'x.webp' },
      nsfw: false,
      ttlMs: 0
    })
    expect(isExpired(done, 2_000)).toBe(true)
    expect(isExpired(running, 2_000)).toBe(false)
  })
})
