import { computed, watch } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { isCoveredByMissingModelsToast } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import type { MissingResourcesToastState } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

/** Closes the error overlay while the toast lists every issue it would show, and reopens it when another issue appears. */
export function useCloseOverlayCoveredByToast(
  toastKind: () => MissingResourcesToastState['kind']
) {
  const executionErrorStore = useExecutionErrorStore()
  const workflowStore = useWorkflowStore()
  const missingModelStore = useMissingModelStore()
  const missingNodesStore = useMissingNodesErrorStore()
  const missingMediaStore = useMissingMediaStore()

  const otherIssues = computed(
    () =>
      missingNodesStore.hasMissingNodes ||
      (missingMediaStore.visibleMissingMediaCandidates?.length ?? 0) > 0 ||
      executionErrorStore.errorClassification.hasBlockingError
  )

  const coveredByToast = computed(() =>
    isCoveredByMissingModelsToast({
      toastKind: toastKind(),
      missingModels: missingModelStore.hasMissingModels,
      otherIssues: otherIssues.value
    })
  )

  let closedByToast = false

  watch(
    () => workflowStore.activeWorkflow,
    () => {
      closedByToast = false
    },
    { flush: 'sync' }
  )

  watch(
    () => executionErrorStore.isErrorOverlayOpen && coveredByToast.value,
    (overlayRepeatsToast) => {
      if (!overlayRepeatsToast) return
      executionErrorStore.dismissErrorOverlay()
      closedByToast = true
    },
    { immediate: true }
  )

  watch(
    () => executionErrorStore.isErrorOverlayOpen,
    (open) => {
      if (open) closedByToast = false
    }
  )

  watch(otherIssues, (present) => {
    if (!present || !closedByToast) return
    closedByToast = false
    executionErrorStore.showErrorOverlay()
  })
}
