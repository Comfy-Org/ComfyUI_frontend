import { describe, expect, it } from 'vitest'

import type { TaskItemImpl } from '@/stores/queueStore'
import { isActiveJobState, jobStateFromTask } from '@/utils/queueUtil'

describe('isActiveJobState', () => {
  it('returns true for pending', () => {
    expect(isActiveJobState('pending')).toBe(true)
  })

  it('returns true for initialization', () => {
    expect(isActiveJobState('initialization')).toBe(true)
  })

  it('returns true for running', () => {
    expect(isActiveJobState('running')).toBe(true)
  })

  it('returns false for completed', () => {
    expect(isActiveJobState('completed')).toBe(false)
  })

  it('returns false for failed', () => {
    expect(isActiveJobState('failed')).toBe(false)
  })
})

describe('jobStateFromTask', () => {
  function makeTask(displayStatus: string) {
    return { displayStatus } as unknown as TaskItemImpl
  }

  it('returns initialization when isInitializing is true', () => {
    expect(jobStateFromTask(makeTask('Running'), true)).toBe('initialization')
  })

  it('maps Running to running', () => {
    expect(jobStateFromTask(makeTask('Running'), false)).toBe('running')
  })

  it('maps Pending to pending', () => {
    expect(jobStateFromTask(makeTask('Pending'), false)).toBe('pending')
  })

  it('maps Completed to completed', () => {
    expect(jobStateFromTask(makeTask('Completed'), false)).toBe('completed')
  })

  it('maps Failed to failed', () => {
    expect(jobStateFromTask(makeTask('Failed'), false)).toBe('failed')
  })

  it('maps Cancelled to failed', () => {
    expect(jobStateFromTask(makeTask('Cancelled'), false)).toBe('failed')
  })

  it('returns failed for unknown status', () => {
    expect(jobStateFromTask(makeTask('Unknown'), false)).toBe('failed')
  })
})
