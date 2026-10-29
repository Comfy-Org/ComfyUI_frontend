import { describe, expect, it } from 'vitest'

import type {
  CloudMissingModel,
  CloudWorkflowCheckState,
  CloudWorkflowGaps
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import type { ModelUploadState } from '@/platform/openOnCloud/modelUpload'
import type { RunOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { runOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'

const lora: CloudMissingModel = {
  name: 'add-detail-xl.safetensors',
  folder: 'loras',
  bytes: 200
}
const checkpoint: CloudMissingModel = {
  name: 'juggernautXL_v9.safetensors',
  folder: 'checkpoints',
  bytes: 800
}

const packsOnly: CloudWorkflowGaps = {
  nodePacks: ['rgthree-comfy', 'comfyui-impact-pack'],
  models: []
}
const packsAndModel: CloudWorkflowGaps = {
  nodePacks: ['rgthree-comfy'],
  models: [lora]
}
const modelsOnly: CloudWorkflowGaps = {
  nodePacks: [],
  models: [lora, checkpoint]
}

const idleUpload: ModelUploadState = { phase: 'idle' }

function answered(
  verdict: Extract<CloudWorkflowCheckState, { phase: 'answered' }>['verdict']
): CloudWorkflowCheckState {
  return { phase: 'answered', verdict }
}

describe(runOnCloudModalState, () => {
  it.for<{
    name: string
    check: CloudWorkflowCheckState
    expected: RunOnCloudModalState
  }>([
    {
      name: 'no check yet opens the checking modal',
      check: { phase: 'idle' },
      expected: { kind: 'checking' }
    },
    {
      name: 'a running check opens the checking modal',
      check: { phase: 'checking', run: 3 },
      expected: { kind: 'checking' }
    },
    {
      name: 'Comfy Cloud can run it: the ready modal',
      check: answered({ kind: 'canOpen' }),
      expected: { kind: 'ready' }
    },
    {
      name: 'signed out: the signed-out modal',
      check: answered({ kind: 'signedOut' }),
      expected: { kind: 'signedOut' }
    },
    {
      name: 'node packs missing: Deploy your setup',
      check: answered({ kind: 'missing', gaps: packsOnly }),
      expected: { kind: 'deploySetup' }
    },
    {
      name: 'node packs and models missing: Deploy your setup',
      check: answered({ kind: 'missing', gaps: packsAndModel }),
      expected: { kind: 'deploySetup' }
    },
    {
      name: 'only models missing: the Upload models dialog',
      check: answered({ kind: 'missing', gaps: modelsOnly }),
      expected: { kind: 'uploadModels', models: [lora, checkpoint] }
    }
  ])('$name', ({ check, expected }) => {
    expect(runOnCloudModalState(check, idleUpload)).toEqual(expected)
  })

  it('shows a running upload and how far it has got over the answer', () => {
    const upload: ModelUploadState = {
      phase: 'uploading',
      models: [lora, checkpoint],
      uploadedBytes: 380
    }

    expect(
      runOnCloudModalState(
        answered({ kind: 'missing', gaps: modelsOnly }),
        upload
      )
    ).toEqual({ kind: 'uploading', models: [lora, checkpoint], percent: 38 })
  })
})
