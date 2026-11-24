import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import RunOnCloudDialog from '@/platform/openOnCloud/components/RunOnCloudDialog.vue'
import { useLocalModelUploadStore } from '@/platform/openOnCloud/stores/localModelUploadStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/openOnCloud/cloudCompatibilityApi'))

describe('Run on Cloud dialog', () => {
  it('dismisses an upload recovery dialog when the workspace changes', async () => {
    stubFirebaseAuthHarness()
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
})
