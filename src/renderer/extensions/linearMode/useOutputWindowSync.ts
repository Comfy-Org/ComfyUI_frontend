import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'

/**
 * Bridges `linearOutputStore.activeWorkflowInProgressItems` (the
 * skeleton → latent → image lifecycle for the current/active runs)
 * into `outputWindowStore.windows` (the moodboard).
 *
 * The window store is monotonic by design: items that *finalized*
 * (state was `'image'`) and then got absorbed out of the in-progress
 * list stay rendered as windows. Items that disappear while still in
 * `'skeleton'` / `'latent'` were cancelled, so their windows go too.
 *
 * Also resolves each window's owning AssetItem from `outputs.media`
 * once the run lands there. Match key is `user_metadata.jobId`, the
 * same pivot `linearOutputStore.pendingResolve` uses to absorb items.
 *
 * Runs once at the call site (App Mode root). Idempotent — safe to
 * call from multiple components if needed; the watches are the only
 * side effects.
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
        if (old.state !== 'image') {
          // Skeleton / latent disappearing without an image landed —
          // run was cancelled or errored. Drop the window so we don't
          // leave a perpetual placeholder on the canvas.
          windowStore.remove(old.id)
        }
        // Image items absorbed into the persistent asset list — leave
        // their windows in place. The store already captured `output`
        // on the last upsert, so the window stays renderable.
      }
    },
    { immediate: true }
  )

  // Asset resolution: walk media + windows whenever either changes,
  // attach matching assets to windows that don't have one yet.
  // O(media × windows) on each tick; fine at session-realistic
  // counts (tens of windows, tens-to-low-hundreds of media items)
  // and avoids maintaining a parallel index.
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
