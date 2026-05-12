import { describe, expect, it } from 'vitest'

import type { TaskItemImpl } from '@/stores/queueStore'

import { isActiveJobState, jobStateFromTask } from './queueUtil'

type TaskDisplayStatus =
  | 'Running'
  | 'Pending'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'

const taskWithStatus = (displayStatus: TaskDisplayStatus): TaskItemImpl =>
  ({ displayStatus }) as unknown as TaskItemImpl

describe('jobStateFromTask', () => {
  it('returns initialization when isInitializing is true regardless of status', () => {
    expect(jobStateFromTask(taskWithStatus('Running'), true)).toBe(
      'initialization'
    )
    expect(jobStateFromTask(taskWithStatus('Pending'), true)).toBe(
      'initialization'
    )
  })

  it('maps Running to running', () => {
    expect(jobStateFromTask(taskWithStatus('Running'), false)).toBe('running')
  })

  it('maps Pending to pending', () => {
    expect(jobStateFromTask(taskWithStatus('Pending'), false)).toBe('pending')
  })

  it('maps Completed to completed', () => {
    expect(jobStateFromTask(taskWithStatus('Completed'), false)).toBe(
      'completed'
    )
  })

  it('maps Failed to failed', () => {
    expect(jobStateFromTask(taskWithStatus('Failed'), false)).toBe('failed')
  })

  it('maps Cancelled to cancelled (distinct from failed)', () => {
    expect(jobStateFromTask(taskWithStatus('Cancelled'), false)).toBe(
      'cancelled'
    )
  })
})

describe('isActiveJobState', () => {
  it('identifies in-progress states as active', () => {
    expect(isActiveJobState('pending')).toBe(true)
    expect(isActiveJobState('initialization')).toBe(true)
    expect(isActiveJobState('running')).toBe(true)
  })

  it('identifies terminal states as inactive', () => {
    expect(isActiveJobState('completed')).toBe(false)
    expect(isActiveJobState('failed')).toBe(false)
    expect(isActiveJobState('cancelled')).toBe(false)
  })
})
