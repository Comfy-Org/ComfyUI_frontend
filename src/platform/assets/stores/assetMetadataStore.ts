import { useDebounceFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { onScopeDispose, ref, shallowReactive, watch } from 'vue'

import type {
  AssetItem,
  AssetUserMetadata
} from '@/platform/assets/schemas/assetSchema'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAssetsStore } from '@/stores/assetsStore'

export const useAssetMetadataStore = defineStore('assetMetadata', () => {
  const assetsStore = useAssetsStore()
  const workspaceStore = useTeamWorkspaceStore()
  const drafts = shallowReactive(
    new Map<string, ReturnType<typeof createDraft>>()
  )

  watch(
    [() => workspaceStore.workspaceId, () => workspaceStore.identityGeneration],
    () => drafts.clear(),
    { flush: 'sync' }
  )
  onScopeDispose(() => drafts.clear())

  function createDraft(initialAsset: AssetItem, initialCacheKey?: string) {
    const updates = ref<AssetUserMetadata>({})
    let targetAsset = initialAsset
    let targetCacheKey = initialCacheKey
    let saving = false
    const draft = { updates, queue }

    const flush = useDebounceFn(async () => {
      if (
        drafts.get(initialAsset.id) !== draft ||
        saving ||
        targetAsset.is_immutable !== false
      )
        return
      const submitted = updates.value
      if (Object.keys(submitted).length === 0) return
      const metadata = { ...targetAsset.user_metadata, ...submitted }
      saving = true
      const saved = await assetsStore.updateAssetMetadata(
        targetAsset,
        metadata,
        targetCacheKey
      )
      saving = false
      if (drafts.get(initialAsset.id) !== draft) return
      const hasNewerEdits = updates.value !== submitted
      if (saved) {
        targetAsset = { ...targetAsset, user_metadata: metadata }
        const confirmed = new Map(Object.entries(submitted))
        updates.value = Object.fromEntries(
          Object.entries(updates.value).filter(
            ([key, value]) =>
              !confirmed.has(key) || value !== confirmed.get(key)
          )
        )
      }
      if (Object.keys(updates.value).length === 0)
        drafts.delete(initialAsset.id)
      else if (saved || hasNewerEdits) void flush()
    }, 500)

    function queue(
      newUpdates: AssetUserMetadata,
      currentAsset: AssetItem,
      currentCacheKey?: string
    ) {
      targetAsset = currentAsset
      targetCacheKey = currentCacheKey
      updates.value = { ...updates.value, ...newUpdates }
      void flush()
    }

    return draft
  }

  function queueUpdate(
    asset: AssetItem,
    updates: AssetUserMetadata,
    cacheKey?: string
  ) {
    if (asset.is_immutable !== false) return
    let draft = drafts.get(asset.id)
    if (!draft) {
      draft = createDraft(asset, cacheKey)
      drafts.set(asset.id, draft)
    }
    draft.queue(updates, asset, cacheKey)
  }

  function getPendingUpdates(assetId: string): AssetUserMetadata {
    return drafts.get(assetId)?.updates.value ?? {}
  }

  return { queueUpdate, getPendingUpdates }
})
