import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { assetService } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentLibraryModelsStore } from '@/platform/workspace/stores/deploymentLibraryModelsStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/useFeatureFlags'))

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  release_id: 'release-1',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z',
  can_start: false
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

  it('moves a model from its old folder to its new one when its type changes', async () => {
    library.set('loras', ['my_style.safetensors'])
    const store = useDeploymentLibraryModelsStore()
    store.watchFolder('loras', () => {})
    store.watchFolder('checkpoints', () => {})
    await store.waitForSettled('loras')
    await store.waitForSettled('checkpoints')
    expect(store.namesIn('loras')).toEqual(['my_style.safetensors'])

    const asset: AssetItem = {
      id: '3f0b6c1e-0000-4000-8000-000000000001',
      name: 'my_style.safetensors',
      tags: ['models', 'loras'],
      created_at: '2026-10-29T00:00:00Z',
      updated_at: '2026-10-29T00:00:00Z'
    }
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ total_tags: ['models'], removed: ['loras'] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total_tags: ['models', 'checkpoints'],
            added: ['checkpoints']
          }),
          { status: 200 }
        )
      )
    library.set('loras', [])
    library.set('checkpoints', ['my_style.safetensors'])
    await useAssetsStore().updateAssetTags(asset, ['models', 'checkpoints'])
    await Promise.all(
      vi
        .mocked(assetService.getWorkspaceLibraryModels)
        .mock.results.map((read) => read.value)
    )

    expect(store.namesIn('loras')).toEqual([])
    expect(store.namesIn('checkpoints')).toEqual(['my_style.safetensors'])
  })
})
