import { describe, expect, it } from 'vitest'

import type { CloudMenuState } from '@/platform/openOnCloud/cloudMenuState'
import { cloudMenuState } from '@/platform/openOnCloud/cloudMenuState'
import type {
  CloudMissingModel,
  CloudWorkflowCheckState,
  CloudWorkflowGaps
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import type { ModelUploadState } from '@/platform/openOnCloud/modelUpload'

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

describe(cloudMenuState, () => {
  it.for<{
    name: string
    check: CloudWorkflowCheckState
    expected: CloudMenuState
  }>([
    {
      name: 'no check yet shows checking',
      check: { phase: 'idle' },
      expected: { kind: 'checking' }
    },
    {
      name: 'a running check shows checking',
      check: { phase: 'checking', run: 3 },
      expected: { kind: 'checking' }
    },
    {
      name: 'Comfy Cloud can run it: Open',
      check: answered({ kind: 'canOpen' }),
      expected: { kind: 'canOpen' }
    },
    {
      name: 'signed out: Sign in',
      check: answered({ kind: 'signedOut' }),
      expected: { kind: 'signedOut' }
    },
    {
      name: 'node packs missing: Convert',
      check: answered({ kind: 'missing', gaps: packsOnly }),
      expected: { kind: 'convert', gaps: packsOnly }
    },
    {
      name: 'node packs and models missing: Convert, keeping both',
      check: answered({ kind: 'missing', gaps: packsAndModel }),
      expected: { kind: 'convert', gaps: packsAndModel }
    },
    {
      name: 'only models missing: Upload them',
      check: answered({ kind: 'missing', gaps: modelsOnly }),
      expected: { kind: 'upload', models: [lora, checkpoint] }
    }
  ])('$name', ({ check, expected }) => {
    expect(cloudMenuState(check, idleUpload)).toEqual(expected)
  })

  it('shows a running upload and how far it has got over the answer', () => {
    const upload: ModelUploadState = {
      phase: 'uploading',
      models: [lora, checkpoint],
      uploadedBytes: 380
    }

    expect(
      cloudMenuState(answered({ kind: 'missing', gaps: modelsOnly }), upload)
    ).toEqual({ kind: 'uploading', models: [lora, checkpoint], percent: 38 })
  })
})
