import { effectScope, watch } from 'vue'
import type { EffectScope, Ref } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

/**
 * Keeps workflowTabActivityStore consistent with the tab strip while the
 * agent panel is unmounted: activating a tab clears its unseen dot and
 * closing tabs prunes stale state. Registered once from the extension
 * setup, so the watchers outlive panel close and app-mode switches.
 */
export function registerWorkflowTabActivityTracker(
  enabled: Readonly<Ref<boolean>>
): () => void {
  const scope = effectScope(true)
  let trackerScope: EffectScope | undefined
  scope.run(() => {
    const workflowStore = useWorkflowStore()
    const tabActivity = useWorkflowTabActivityStore()

    watch(
      enabled,
      (isEnabled) => {
        trackerScope?.stop()
        trackerScope = undefined
        if (!isEnabled) {
          tabActivity.clearAgentActivity()
          return
        }

        trackerScope = effectScope()
        trackerScope.run(() => {
          watch(
            () => workflowStore.activeWorkflow?.path,
            (path) => {
              if (path !== undefined) tabActivity.markSeen(path)
            }
          )
          watch(
            () => workflowStore.openWorkflows.map((tab) => tab.path),
            (paths) => tabActivity.pruneClosed(paths)
          )
        })
      },
      { immediate: true }
    )
  })
  return () => {
    trackerScope?.stop()
    scope.stop()
  }
}
