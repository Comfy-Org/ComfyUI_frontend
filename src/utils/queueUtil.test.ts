import { describe, expect, it } from 'vitest'

import type { JobState } from '@/types/queue'

import { isActiveJobState, isAssetsSidebarJobState } from './queueUtil'

describe('queueUtil', () => {
  it('marks only in-progress states as active', () => {
    const states: Record<JobState, boolean> = {
      pending: true,
      initialization: true,
      running: true,
      completed: false,
      failed: false
    }

    for (const state of Object.keys(states) as JobState[]) {
      expect(isActiveJobState(state)).toBe(states[state])
    }
  })

  it('includes failed states in assets sidebar jobs and excludes completed', () => {
    const states: Record<JobState, boolean> = {
      pending: true,
      initialization: true,
      running: true,
      completed: false,
      failed: true
    }

    for (const state of Object.keys(states) as JobState[]) {
      expect(isAssetsSidebarJobState(state)).toBe(states[state])
    }
  })
})
