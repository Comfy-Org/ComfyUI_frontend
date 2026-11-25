import { useTelemetry } from '@comfyorg/telemetry'
import type { RunOnCloudTelemetryEvent } from '@comfyorg/telemetry/types'
import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import type { CloudWorkflowVerdict } from '@/platform/openOnCloud/cloudWorkflowCheck'
import RunOnCloudDialog from '@/platform/openOnCloud/components/RunOnCloudDialog.vue'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalModelUploadStore } from '@/platform/openOnCloud/stores/localModelUploadStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { testI18n } from '@/utils/__tests__/testI18n'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/openOnCloud/cloudCompatibilityApi'))

describe('Run on Cloud dialog', () => {
  it('dismisses an upload recovery dialog when the workspace changes', async () => {
    const workspaces = useTeamWorkspaceStore()
    Object.assign(workspaces, { activeWorkspaceId: 'ws-upload' })
    const uploads = useLocalModelUploadStore()
    const models = [{ name: 'model.safetensors', folder: 'loras' }]
    uploads.upload = { phase: 'failed', reason: 'storagePending', models }
    uploads.retryBatches = [models]
    vi.spyOn(uploads, 'canFinish').mockReturnValue(true)
    const { emitted } = render(RunOnCloudDialog, {
      props: { uploadBatch: { models, owner: uploads.owner } },
      global: { stubs: { MissingModelsCard: true } }
    })
    expect(emitted().dismiss).toBeUndefined()

    Object.assign(workspaces, { activeWorkspaceId: 'ws-next' })
    await nextTick()

    expect(emitted().dismiss).toEqual([[]])
  })

  it.for<{
    name: string
    signedIn: boolean
    verdict: CloudWorkflowVerdict
    properties: RunOnCloudTelemetryEvent['properties']
  }>([
    {
      name: 'Open on Comfy Cloud to a signed-in person',
      signedIn: true,
      verdict: { kind: 'canOpen' },
      properties: {
        state: 'ready',
        source: 'cloud_button',
        asks_to_sign_in: false,
        unchecked_input_count: 0
      }
    },
    {
      name: 'Open on Comfy Cloud with a linked model it could not check',
      signedIn: true,
      verdict: {
        kind: 'canOpen',
        uncheckedInputs: [
          { nodeType: 'CheckpointLoaderSimple', input: 'ckpt_name' }
        ]
      },
      properties: {
        state: 'ready',
        source: 'cloud_button',
        asks_to_sign_in: false,
        unchecked_input_count: 1
      }
    },
    {
      name: 'Open on Comfy Cloud with its sign-in request',
      signedIn: false,
      verdict: { kind: 'canOpen' },
      properties: {
        state: 'ready',
        source: 'cloud_button',
        asks_to_sign_in: true,
        unchecked_input_count: 0
      }
    },
    {
      name: 'Deploy your setup for missing node packs',
      signedIn: true,
      verdict: {
        kind: 'missing',
        gaps: {
          nodePacks: ['rgthree-comfy'],
          models: [{ name: 'add-detail-xl.safetensors', folder: 'loras' }]
        }
      },
      properties: { state: 'deploy_setup', source: 'cloud_button' }
    },
    {
      name: 'the missing models',
      signedIn: true,
      verdict: {
        kind: 'missing',
        gaps: {
          nodePacks: [],
          models: [
            { name: 'add-detail-xl.safetensors', folder: 'loras' },
            { name: 'juggernautXL_v9.safetensors', folder: 'checkpoints' }
          ]
        }
      },
      properties: {
        state: 'missing_models',
        source: 'cloud_button',
        missing_model_count: 2
      }
    }
  ])(
    'reports showing $name once',
    async ({ signedIn, verdict, properties }) => {
      useCurrentUser().isLoggedIn = computed(() => signedIn)
      vi.mocked(checkCloudCompatibility).mockResolvedValue(verdict)
      await useCloudWorkflowCheckStore().check()

      render(RunOnCloudDialog, {
        global: {
          plugins: [testI18n],
          stubs: {
            DeploySetupCard: true,
            MissingModelsCard: true,
            RunOnCloudCard: true
          }
        }
      })

      expect(
        useTelemetry()?.trackRunOnCloudEvent
      ).toHaveBeenCalledExactlyOnceWith({
        name: 'app:run_on_cloud_dialog_shown',
        properties
      })
    }
  )
})
