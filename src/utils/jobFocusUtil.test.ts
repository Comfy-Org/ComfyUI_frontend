import { describe, expect, it } from 'vitest'

import type { NodeProgressState } from '@comfyorg/api-client/executionTypes'

import { jobProgressFraction, pickNextFocusedJob } from './jobFocusUtil'

describe(pickNextFocusedJob, () => {
  it.for<{
    name: string
    started: string[]
    owned: string[]
    expected: string | null
  }>([
    {
      name: "the active tab's newest job over a newer job elsewhere",
      started: ['own-old', 'own-new', 'other'],
      owned: ['own-old', 'own-new'],
      expected: 'own-new'
    },
    {
      name: 'the newest job overall when the active tab has none',
      started: ['other-old', 'other-new'],
      owned: [],
      expected: 'other-new'
    },
    {
      name: 'nothing when no job has started',
      started: [],
      owned: [],
      expected: null
    }
  ])('picks $name', ({ started, owned, expected }) => {
    expect(pickNextFocusedJob(started, (jobId) => owned.includes(jobId))).toBe(
      expected
    )
  })
})

describe(jobProgressFraction, () => {
  const states = (...values: NodeProgressState['state'][]) =>
    values.map((state) => ({ state }))

  it.for<{
    name: string
    queued: boolean[]
    progress: Pick<NodeProgressState, 'state'>[]
    expected: number
  }>([
    {
      name: 'the queued node list when there is one',
      queued: [true, false, false, false],
      progress: states('finished', 'finished'),
      expected: 0.25
    },
    {
      name: 'the finished share of progress frames for a job not queued here',
      queued: [],
      progress: states('finished', 'running', 'pending', 'finished'),
      expected: 0.5
    },
    {
      name: 'zero without any data',
      queued: [],
      progress: [],
      expected: 0
    }
  ])('uses $name', ({ queued, progress, expected }) => {
    expect(jobProgressFraction(queued, progress)).toBe(expected)
  })
})
