import { describe, expect, it, vi } from 'vitest'

import type {
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState,
  CloudWorkflowVerdict
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  PROTOTYPE_CHECK_MS,
  PROTOTYPE_GAPS,
  prototypeCloudWorkflowChecker,
  reduceCloudWorkflowCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { defaultGraph } from '@/scripts/defaultGraph'

const canOpen: CloudWorkflowVerdict = { kind: 'canOpen' }
const missing: CloudWorkflowVerdict = {
  kind: 'missing',
  gaps: { nodeTypes: ['UltimateSDUpscale'], models: ['4x-UltraSharp.pth'] }
}

describe(reduceCloudWorkflowCheck, () => {
  it.for<{
    name: string
    state: CloudWorkflowCheckState
    event: CloudWorkflowCheckEvent
    expected: CloudWorkflowCheckState
  }>([
    {
      name: 'a check starts from idle',
      state: { phase: 'idle' },
      event: { type: 'started', run: 1 },
      expected: { phase: 'checking', run: 1 }
    },
    {
      name: 'a new check replaces an earlier answer',
      state: { phase: 'answered', verdict: canOpen },
      event: { type: 'started', run: 2 },
      expected: { phase: 'checking', run: 2 }
    },
    {
      name: 'the running check takes its answer',
      state: { phase: 'checking', run: 2 },
      event: { type: 'answered', run: 2, verdict: missing },
      expected: { phase: 'answered', verdict: missing }
    },
    {
      name: 'an earlier check cannot answer for the running one',
      state: { phase: 'checking', run: 2 },
      event: { type: 'answered', run: 1, verdict: canOpen },
      expected: { phase: 'checking', run: 2 }
    },
    {
      name: 'an answer with no check running is dropped',
      state: { phase: 'answered', verdict: canOpen },
      event: { type: 'answered', run: 1, verdict: missing },
      expected: { phase: 'answered', verdict: canOpen }
    }
  ])('$name', ({ state, event, expected }) => {
    expect(reduceCloudWorkflowCheck(state, event)).toEqual(expected)
  })
})

describe(prototypeCloudWorkflowChecker, () => {
  it.for<{ pick: 'canOpen' | 'missing'; verdict: CloudWorkflowVerdict }>([
    { pick: 'canOpen', verdict: { kind: 'canOpen' } },
    { pick: 'missing', verdict: { kind: 'missing', gaps: PROTOTYPE_GAPS } }
  ])(
    'answers $pick after the pause the switch asks for',
    async ({ pick, verdict }) => {
      const answer = prototypeCloudWorkflowChecker(() => pick)(defaultGraph)

      await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

      await expect(answer).resolves.toEqual(verdict)
    }
  )

  it('keeps checking while the switch says checking', async () => {
    const onAnswer = vi.fn()
    void prototypeCloudWorkflowChecker(() => 'checking')(defaultGraph).then(
      onAnswer
    )

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS * 10)

    expect(onAnswer).not.toHaveBeenCalled()
  })
})
