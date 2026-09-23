import { describe, expect, it } from 'vitest'

import { runSaying, runSteps, stepReached } from './run-progress'

describe('runSteps', () => {
  // A wait on a server that is already awake is a queue; one that has to be
  // woken is a longer wait with a different story, and saying so is the point.
  it('tells a cold start as the longer wait it is', () => {
    expect(runSteps(false)).toHaveLength(2)
    expect(runSteps(true)).toHaveLength(3)
    expect(runSteps(true)[0]).toBe('workshop.v2.run.waking')
  })
})

describe('stepReached', () => {
  it.for([
    ['idle', false, -1],
    ['error', false, -1],
    ['uploading', false, 0],
    ['submitting', false, 0],
    ['tracking', true, 0],
    ['tracking', false, 1],
    ['finished', false, 2]
  ] as const)('places %s at the right step', ([phase, queued, expected]) => {
    expect(stepReached(phase, queued, 2)).toBe(expected)
  })
})

describe('runSaying', () => {
  // Before the job exists the page is doing the work, so it says so. Once it
  // exists, the step is the whole answer and a line repeating it says nothing.
  it.for([
    ['uploading', 'workshop.v2.run.uploading'],
    ['submitting', 'workshop.v2.run.sending'],
    ['reconnecting', 'workshop.v2.run.reconnecting'],
    ['idle', undefined],
    ['finished', undefined]
  ] as const)('says %s in its own words', ([phase, expected]) => {
    expect(runSaying(phase, 'workshop.v2.run.queued')).toBe(expected)
  })

  it('hands the step back once the job is the thing being waited on', () => {
    expect(runSaying('tracking', 'workshop.v2.run.generating')).toBe(
      'workshop.v2.run.generating'
    )
  })
})
