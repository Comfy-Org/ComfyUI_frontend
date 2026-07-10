import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { AssetId } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'

/**
 * Per-asset workspace visibility, keyed by {@link AssetId}.
 *
 * Assets are **private by default**; only ids that have been explicitly shared
 * are tracked here, so the empty state costs nothing. `share`/`unshare` are
 * idempotent, order-independent command actions over a set of ids — the single
 * source of truth read by the card marker, the visibility filter, and the
 * selection/context-menu actions.
 *
 * Visibility is deliberately NOT a field on the asset schema (that is the server
 * contract) — see ADR-0003 / ADR-0008. This reference build keeps the mapping
 * client-side; wiring it to a real share endpoint is a follow-up.
 */
export const useAssetVisibilityStore = defineStore('assetVisibility', () => {
  const sharedAssetIds = ref<Set<AssetId>>(new Set())

  function isShared(assetId: AssetId): boolean {
    return isCloud && sharedAssetIds.value.has(assetId)
  }

  function share(assetIds: AssetId[]) {
    if (!isCloud) return
    for (const id of assetIds) sharedAssetIds.value.add(id)
  }

  function unshare(assetIds: AssetId[]) {
    if (!isCloud) return
    for (const id of assetIds) sharedAssetIds.value.delete(id)
  }

  return { isShared, share, unshare }
})
