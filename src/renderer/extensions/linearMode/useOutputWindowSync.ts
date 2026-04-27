import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'

/**
 * Bridges `linearOutputStore.activeWorkflowInProgressItems` into the
 * monotonic `outputWindowStore`. Finalized (`'image'`) windows stay
 * rendered after the source item is absorbed; pre-image
 * disappearance = cancellation, so those windows are removed.
 * Also resolves each window's `AssetItem` from `outputs.media` via
 * `user_metadata.jobId`.
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
        // Pre-image disappearance is cancellation; image-state
        // disappearance is absorption (window keeps its output).
        if (old.state !== 'image') windowStore.remove(old.id)
      }
    },
    { immediate: true }
  )

  // O(media × windows) is fine at session counts; avoids a parallel index.
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
