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
    signedIn: RunOnCloudModalState
    signedOut: RunOnCloudModalState
  }>([
    {
      name: 'no check yet: checking',
      check: { phase: 'idle' },
      signedIn: { kind: 'checking' },
      signedOut: { kind: 'checking' }
    },
    {
      name: 'a running check: checking',
      check: { phase: 'checking', run: 3 },
      signedIn: { kind: 'checking' },
      signedOut: { kind: 'checking' }
    },
    {
      name: 'Comfy Cloud can run it: Open, which asks a signed-out person to sign in',
      check: answered({ kind: 'canOpen' }),
      signedIn: { kind: 'ready', asksToSignIn: false },
      signedOut: { kind: 'ready', asksToSignIn: true }
    },
    {
      name: 'node packs missing: Deploy your setup',
      check: answered({ kind: 'missing', gaps: packsOnly }),
      signedIn: { kind: 'deploySetup' },
      signedOut: { kind: 'deploySetup' }
    },
    {
      name: 'node packs and models missing: Deploy your setup',
      check: answered({ kind: 'missing', gaps: packsAndModel }),
      signedIn: { kind: 'deploySetup' },
      signedOut: { kind: 'deploySetup' }
    },
    {
      name: 'only models missing: Upload models, which signs a signed-out person in first',
      check: answered({ kind: 'missing', gaps: modelsOnly }),
      signedIn: {
        kind: 'uploadModels',
        models: [lora, checkpoint],
        signInToUpload: false
      },
      signedOut: {
        kind: 'uploadModels',
        models: [lora, checkpoint],
        signInToUpload: true
      }
    }
  ])('$name', ({ check, signedIn, signedOut }) => {
    expect(runOnCloudModalState(check, idleUpload, { signedIn: true })).toEqual(
      signedIn
    )
    expect(
      runOnCloudModalState(check, idleUpload, { signedIn: false })
    ).toEqual(signedOut)
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
        upload,
        { signedIn: true }
      )
    ).toEqual({ kind: 'uploading', models: [lora, checkpoint], percent: 38 })
  })
})
