import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'

/**
 * Bridges `linearOutputStore.activeWorkflowInProgressItems` into
 * `outputWindowStore.windows`. Window store is monotonic: finalized
 * (state was `'image'`) windows stay rendered after the source item
 * gets absorbed out of the in-progress list; skeleton/latent items
 * that disappear were cancelled, and their windows go too.
 *
 * Also resolves each window's owning AssetItem from `outputs.media`
 * via `user_metadata.jobId` — the same pivot
 * `linearOutputStore.pendingResolve` uses to absorb items.
 */
export function useOutputWindowSync(): void {
  const linearStore = useLinearOutputStore()
  const windowStore = useOutputWindowStore()
  const { outputs } = useOutputHistory()
  const { activeWorkflowInProgressItems } = storeToRefs(linearStore)

  watch(
    activeWorkflowInProgressItems,
    (items, oldItems) => {
      for (const item of items) {
        windowStore.upsert(item.id, {
          jobId: item.jobId,
          state: item.state,
          latentPreviewUrl: item.latentPreviewUrl,
          output: item.output
        })
      }
      if (!oldItems) return
      const currentIds = new Set(items.map((i) => i.id))
      for (const old of oldItems) {
        if (currentIds.has(old.id)) continue
        // Pre-image disappearance = cancel; image disappearance =
        // absorbed into outputs.media (window already has `output`,
        // stays renderable).
        if (old.state !== 'image') windowStore.remove(old.id)
      }
    },
    { immediate: true }
  )

  // O(media × windows) per tick is fine at session-realistic counts;
  // avoids maintaining a parallel jobId index.
  watch(
    [() => outputs.media.value, () => windowStore.windows],
    ([assets, windows]) => {
      for (const w of windows) {
        if (w.asset || !w.jobId) continue
        const matched = assets.find((asset) => {
          const meta = getOutputAssetMetadata(asset?.user_metadata)
          return meta?.jobId === w.jobId
        })
        if (matched) windowStore.attachAsset(w.id, matched)
      }
    },
    { immediate: true }
  )
}
