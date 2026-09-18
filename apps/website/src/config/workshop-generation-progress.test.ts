import { describe, expect, it } from 'vitest'

import {
  estimatedGenerationProgress,
  generationTimeEstimates,
  roundGenerationSeconds
} from './workshop-generation-progress'

describe('generation time estimates', () => {
  it.for([
    { elapsedMs: 3_127, seconds: 10 },
    { elapsedMs: 10_000, seconds: 10 },
    { elapsedMs: 10_001, seconds: 20 },
    { elapsedMs: 60_000, seconds: 60 },
    { elapsedMs: 60_001, seconds: 90 },
    { elapsedMs: 142_313, seconds: 150 },
    { elapsedMs: 300_000, seconds: 300 },
    { elapsedMs: 300_001, seconds: 360 },
    { elapsedMs: 962_020, seconds: 1_020 },
    { elapsedMs: 0, seconds: undefined },
    { elapsedMs: -1, seconds: undefined },
    { elapsedMs: NaN, seconds: undefined },
    { elapsedMs: Infinity, seconds: undefined }
  ])('rounds $elapsedMs up to $seconds seconds', ({ elapsedMs, seconds }) => {
    expect(roundGenerationSeconds(elapsedMs)).toBe(seconds)
  })

  it('uses only successful production default runs, retaining a pass after a failure', () => {
    const sample = {
      slug: 'measured',
      environment: 'prod',
      inputMode: 'page-defaults',
      lastSuccess: { status: 'passed', elapsedMs: 111_207 }
    }
    const rows = [
      { ...sample, live: { status: 'failed', elapsedMs: 200 } },
      { ...sample, slug: 'staging', environment: 'staging' },
      { ...sample, slug: 'custom', inputMode: 'custom-inputs' },
      {
        ...sample,
        slug: 'failed',
        lastSuccess: { status: 'failed', elapsedMs: 100 }
      },
      { ...sample, slug: 'untimed', lastSuccess: { status: 'passed' } },
      {
        ...sample,
        slug: 'zero',
        lastSuccess: { status: 'passed', elapsedMs: 0 }
      }
    ]
    expect([...generationTimeEstimates(rows)]).toEqual([['measured', 120]])
  })
})

describe('estimated generation progress', () => {
  it.for([
    { elapsedMs: -1, percent: 0 },
    { elapsedMs: 0, percent: 0 },
    { elapsedMs: 60_000, percent: 47.5 },
    { elapsedMs: 120_000, percent: 95 },
    { elapsedMs: Number.MAX_SAFE_INTEGER, percent: 99 }
  ])('shows $percent at $elapsedMs ms', ({ elapsedMs, percent }) => {
    expect(estimatedGenerationProgress(elapsedMs, 120)).toBe(percent)
  })

  it('slows exponentially after the estimate and leaves the ring unfinished', () => {
    const early = estimatedGenerationProgress(150_000, 120)
    const middle = estimatedGenerationProgress(180_000, 120)
    const late = estimatedGenerationProgress(210_000, 120)
    expect(early).toBeGreaterThan(95)
    expect(late).toBeLessThan(99)
    expect(middle - early).toBeGreaterThan(late - middle)
    expect(late - middle).toBeGreaterThan(0)
  })
})
