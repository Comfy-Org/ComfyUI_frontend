import { describe, expect, it, vi } from 'vitest'

import type {
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState,
  CloudWorkflowVerdict,
  PrototypeCloudCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  PROTOTYPE_CHECK_MS,
  prototypeCloudWorkflowChecker,
  reduceCloudWorkflowCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { defaultGraph } from '@/scripts/defaultGraph'

const canOpen: CloudWorkflowVerdict = { kind: 'canOpen' }
const missing: CloudWorkflowVerdict = {
  kind: 'missing',
  gaps: { nodePacks: ['comfyui-impact-pack'], models: ['4x-UltraSharp.pth'] }
}

describe(reduceCloudWorkflowCheck, () => {
  it.for<{
    name: string
    state: CloudWorkflowCheckState
    event: CloudWorkflowCheckEvent
    expected: CloudWorkflowCheckState
  }>([
    {
      name: 'a check starts from idle with no modal to open',
      state: { phase: 'idle' },
      event: { type: 'started', run: 1 },
      expected: { phase: 'checking', run: 1, opensModal: false }
    },
    {
      name: 'a new check replaces an answer whose modal is closed',
      state: { phase: 'answered', verdict: canOpen, showsModal: false },
      event: { type: 'started', run: 2 },
      expected: { phase: 'checking', run: 2, opensModal: false }
    },
    {
      name: 'a new check while the modal shows reopens it with the new answer',
      state: { phase: 'answered', verdict: canOpen, showsModal: true },
      event: { type: 'started', run: 2 },
      expected: { phase: 'checking', run: 2, opensModal: true }
    },
    {
      name: 'a restarted check keeps the modal it was to open',
      state: { phase: 'checking', run: 1, opensModal: true },
      event: { type: 'started', run: 2 },
      expected: { phase: 'checking', run: 2, opensModal: true }
    },
    {
      name: 'the running check takes its answer without a modal',
      state: { phase: 'checking', run: 2, opensModal: false },
      event: { type: 'answered', run: 2, verdict: missing },
      expected: { phase: 'answered', verdict: missing, showsModal: false }
    },
    {
      name: 'the running check takes its answer and shows the modal asked for',
      state: { phase: 'checking', run: 2, opensModal: true },
      event: { type: 'answered', run: 2, verdict: missing },
      expected: { phase: 'answered', verdict: missing, showsModal: true }
    },
    {
      name: 'an earlier check cannot answer for the running one',
      state: { phase: 'checking', run: 2, opensModal: true },
      event: { type: 'answered', run: 1, verdict: canOpen },
      expected: { phase: 'checking', run: 2, opensModal: true }
    },
    {
      name: 'an answer with no check running is dropped',
      state: { phase: 'answered', verdict: canOpen, showsModal: false },
      event: { type: 'answered', run: 1, verdict: missing },
      expected: { phase: 'answered', verdict: canOpen, showsModal: false }
    },
    {
      name: 'a click before any check opens nothing',
      state: { phase: 'idle' },
      event: { type: 'modalRequested' },
      expected: { phase: 'idle' }
    },
    {
      name: 'a click during a check opens the modal when the answer arrives',
      state: { phase: 'checking', run: 1, opensModal: false },
      event: { type: 'modalRequested' },
      expected: { phase: 'checking', run: 1, opensModal: true }
    },
    {
      name: 'a click after the answer shows its modal at once',
      state: { phase: 'answered', verdict: canOpen, showsModal: false },
      event: { type: 'modalRequested' },
      expected: { phase: 'answered', verdict: canOpen, showsModal: true }
    },
    {
      name: 'dismissing the modal hides it',
      state: { phase: 'answered', verdict: canOpen, showsModal: true },
      event: { type: 'modalDismissed' },
      expected: { phase: 'answered', verdict: canOpen, showsModal: false }
    },
    {
      name: 'closing the modal for a new check keeps it to reopen',
      state: { phase: 'checking', run: 2, opensModal: true },
      event: { type: 'modalDismissed' },
      expected: { phase: 'checking', run: 2, opensModal: true }
    }
  ])('$name', ({ state, event, expected }) => {
    expect(reduceCloudWorkflowCheck(state, event)).toEqual(expected)
  })
})

describe(prototypeCloudWorkflowChecker, () => {
  it.for<{ pick: PrototypeCloudCheck; verdict: CloudWorkflowVerdict }>([
    { pick: 'canOpen', verdict: { kind: 'canOpen' } },
    {
      pick: 'nodePacksMissing',
      verdict: {
        kind: 'missing',
        gaps: {
          nodePacks: ['rgthree-comfy', 'comfyui-impact-pack'],
          models: []
        }
      }
    },
    {
      pick: 'nodePacksAndModelsMissing',
      verdict: {
        kind: 'missing',
        gaps: {
          nodePacks: ['rgthree-comfy', 'comfyui-impact-pack'],
          models: ['face_yolov8m.pt']
        }
      }
    },
    { pick: 'signedOut', verdict: { kind: 'signedOut' } }
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
