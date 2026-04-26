import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
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
 * Runs once at the call site (App Mode root). Idempotent — safe to
 * call from multiple components if needed; the watch is the only side
 * effect.
 */
export function useOutputWindowSync(): void {
  const linearStore = useLinearOutputStore()
  const windowStore = useOutputWindowStore()
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
}
