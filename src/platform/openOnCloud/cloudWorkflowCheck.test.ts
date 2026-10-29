import { describe, expect, it, vi } from 'vitest'

import type {
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState,
  CloudWorkflowVerdict,
  PrototypeCheckInput
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  PROTOTYPE_CHECK_MS,
  PROTOTYPE_GAPS,
  prototypeCloudWorkflowChecker,
  prototypeVerdict,
  reduceCloudWorkflowCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { defaultGraph } from '@/scripts/defaultGraph'

const canOpen: CloudWorkflowVerdict = { kind: 'canOpen' }
const missing: CloudWorkflowVerdict = {
  kind: 'missing',
  gaps: {
    nodePacks: ['comfyui-impact-pack'],
    models: [{ name: 'face_yolov8m.pt', folder: 'ultralytics/bbox', bytes: 1 }]
  }
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

describe(prototypeVerdict, () => {
  const { modelsMissing, nodePacksAndModelsMissing } = PROTOTYPE_GAPS
  const allModels = modelsMissing.models.map((model) => model.name)

  it.for<{
    name: string
    input: PrototypeCheckInput
    expected: CloudWorkflowVerdict | null
  }>([
    {
      name: 'compatible can open',
      input: { scenario: 'compatible', uploadedModels: [] },
      expected: { kind: 'canOpen' }
    },
    {
      name: 'signed out says so',
      input: { scenario: 'signedOut', uploadedModels: [] },
      expected: { kind: 'signedOut' }
    },
    {
      name: 'checking never answers',
      input: { scenario: 'checking', uploadedModels: [] },
      expected: null
    },
    {
      name: 'models missing names each model',
      input: { scenario: 'modelsMissing', uploadedModels: [] },
      expected: { kind: 'missing', gaps: modelsMissing }
    },
    {
      name: 'an uploaded model is no longer missing',
      input: { scenario: 'modelsMissing', uploadedModels: allModels.slice(1) },
      expected: {
        kind: 'missing',
        gaps: { nodePacks: [], models: modelsMissing.models.slice(0, 1) }
      }
    },
    {
      name: 'once every model is uploaded it can open',
      input: { scenario: 'modelsMissing', uploadedModels: allModels },
      expected: { kind: 'canOpen' }
    },
    {
      name: 'node packs and models missing names both',
      input: { scenario: 'nodePacksAndModelsMissing', uploadedModels: [] },
      expected: { kind: 'missing', gaps: nodePacksAndModelsMissing }
    }
  ])('$name', ({ input, expected }) => {
    expect(prototypeVerdict(input)).toEqual(expected)
  })
})

describe(prototypeCloudWorkflowChecker, () => {
  const compatible: PrototypeCheckInput = {
    scenario: 'compatible',
    uploadedModels: []
  }

  it('answers after the pause it was made with', async () => {
    const onAnswer = vi.fn()
    void prototypeCloudWorkflowChecker(() => compatible)(defaultGraph).then(
      onAnswer
    )

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS - 1)
    expect(onAnswer).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onAnswer).toHaveBeenCalledWith({ kind: 'canOpen' })
  })

  it('keeps checking while the panel says checking', async () => {
    const onAnswer = vi.fn()
    void prototypeCloudWorkflowChecker(() => ({
      scenario: 'checking',
      uploadedModels: []
    }))(defaultGraph).then(onAnswer)

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS * 10)

    expect(onAnswer).not.toHaveBeenCalled()
  })
})
