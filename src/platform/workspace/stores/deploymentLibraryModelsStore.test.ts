import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { assetService } from '@/platform/assets/services/assetService'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentLibraryModelsStore } from '@/platform/workspace/stores/deploymentLibraryModelsStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/useFeatureFlags'))

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  release_id: 'release-1',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z'
}

describe('useDeploymentLibraryModelsStore', () => {
  const library = new Map<string, string[]>()

  beforeEach(() => {
    library.clear()
    vi.spyOn(assetService, 'getWorkspaceLibraryModels').mockImplementation(
      async (folder) => library.get(folder) ?? []
    )
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    useDeploymentPickStore().bootDeployment = deployment
    vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = true
  })

  it('reads the library fresh when the flag turns off and back on', async () => {
    library.set('loras', ['a.safetensors', 'b.safetensors'])
    const store = useDeploymentLibraryModelsStore()
    store.watchFolder('loras', () => {})
    await store.waitForSettled('loras')
    expect(store.namesIn('loras')).toEqual(['a.safetensors', 'b.safetensors'])

    library.set('loras', ['a.safetensors'])
    vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
    vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = true

    expect(assetService.getWorkspaceLibraryModels).toHaveBeenCalledTimes(2)
    expect(assetService.getWorkspaceLibraryModels).toHaveBeenLastCalledWith(
      'loras'
    )
    await store.waitForSettled('loras')
    expect(store.namesIn('loras')).toEqual(['a.safetensors'])
  })

  it('ignores a read that started before the flag turned off', async () => {
    let answerStale: (names: string[]) => void = () => {}
    const staleRead = new Promise<string[]>((resolve) => {
      answerStale = resolve
    })
    let answerFresh: (names: string[]) => void = () => {}
    const freshRead = new Promise<string[]>((resolve) => {
      answerFresh = resolve
    })
    vi.mocked(assetService.getWorkspaceLibraryModels)
      .mockReturnValueOnce(staleRead)
      .mockReturnValueOnce(freshRead)
    const store = useDeploymentLibraryModelsStore()
    store.watchFolder('loras', () => {})

    vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = false
    vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = true
    answerFresh(['a.safetensors'])
    await freshRead
    answerStale(['a.safetensors', 'b.safetensors'])
    await staleRead

    expect(store.namesIn('loras')).toEqual(['a.safetensors'])
    expect(store.statusOf('loras')).toBe('ready')
  })
})
