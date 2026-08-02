import { describe, expect, it } from 'vitest'

import { createJobsAuthBackoff } from './jobsAuthBackoff'

describe('createJobsAuthBackoff', () => {
  it('does not skip while healthy', () => {
    const gate = createJobsAuthBackoff()
    expect(gate.shouldSkip()).toBe(false)
    expect(gate.shouldSkip()).toBe(false)
  })

  it('reports only the first failure of an episode', () => {
    const gate = createJobsAuthBackoff()
    expect(gate.recordAuthFailure()).toBe(true)
    expect(gate.recordAuthFailure()).toBe(false)
    expect(gate.recordAuthFailure()).toBe(false)
  })

  it('suppresses calls between probes and widens the window as failures persist', () => {
    const gate = createJobsAuthBackoff()

    // First failure → window of 2 skips before the next probe is allowed.
    gate.recordAuthFailure()
    expect(gate.shouldSkip()).toBe(true)
    expect(gate.shouldSkip()).toBe(true)
    expect(gate.shouldSkip()).toBe(false) // probe

    // Probe also fails → window widens to 4 skips before the next probe.
    gate.recordAuthFailure()
    expect([1, 2, 3, 4, 5].map(() => gate.shouldSkip())).toEqual([
      true,
      true,
      true,
      true,
      false
    ])
  })

  it('clears backoff immediately on success', () => {
    const gate = createJobsAuthBackoff()
    gate.recordAuthFailure()
    expect(gate.shouldSkip()).toBe(true)

    gate.recordSuccess()

    expect(gate.shouldSkip()).toBe(false)
    expect(gate.recordAuthFailure()).toBe(true) // next failure is a fresh episode
  })
})
