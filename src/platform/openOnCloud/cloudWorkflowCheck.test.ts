import { describe, expect, it } from 'vitest'

import type {
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { reduceCloudWorkflowCheck } from '@/platform/openOnCloud/cloudWorkflowCheck'

const canOpen = { kind: 'canOpen' } as const

describe(reduceCloudWorkflowCheck, () => {
  it.for<{
    name: string
    state: CloudWorkflowCheckState
    event: CloudWorkflowCheckEvent
  }>([
    {
      name: 'an answer from a superseded run',
      state: { phase: 'checking', run: 2 },
      event: { type: 'answered', run: 1, verdict: canOpen }
    },
    {
      name: 'a failure from a superseded run',
      state: { phase: 'checking', run: 2 },
      event: { type: 'failed', run: 1 }
    },
    {
      name: 'an answer after an edit invalidated the check',
      state: { phase: 'idle' },
      event: { type: 'answered', run: 1, verdict: canOpen }
    },
    {
      name: 'a failure after an edit invalidated the check',
      state: { phase: 'idle' },
      event: { type: 'failed', run: 1 }
    }
  ])('ignores $name', ({ state, event }) => {
    expect(reduceCloudWorkflowCheck(state, event)).toBe(state)
  })

  it.for<{ event: CloudWorkflowCheckEvent; next: CloudWorkflowCheckState }>([
    {
      event: { type: 'answered', run: 2, verdict: canOpen },
      next: { phase: 'answered', verdict: canOpen }
    },
    { event: { type: 'failed', run: 2 }, next: { phase: 'failed' } }
  ])('settles the current run on $event.type', ({ event, next }) => {
    expect(
      reduceCloudWorkflowCheck({ phase: 'checking', run: 2 }, event)
    ).toEqual(next)
  })

  it('keeps the same idle state when an edit lands while idle', () => {
    const idle: CloudWorkflowCheckState = { phase: 'idle' }

    expect(reduceCloudWorkflowCheck(idle, { type: 'invalidated' })).toBe(idle)
  })
})
