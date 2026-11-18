import { computed, watch } from 'vue'

import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { isCoveredByMissingModelsToast } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import type { MissingResourcesToastState } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

/** Holds the error overlay closed while the toast lists every issue it would show, and releases it when another issue appears. */
export function useCloseOverlayCoveredByToast(
  toastKind: () => MissingResourcesToastState['kind']
) {
  const executionErrorStore = useExecutionErrorStore()
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

  watch(
    () => executionErrorStore.isErrorOverlayOpen && coveredByToast.value,
    (overlayRepeatsToast) => {
      if (overlayRepeatsToast) executionErrorStore.holdErrorOverlay()
    },
    { immediate: true }
  )

  watch(otherIssues, (present) => {
    if (present) executionErrorStore.releaseErrorOverlay()
  })

  watch(
    () => missingModelStore.hasMissingModels,
    (missing) => {
      if (!missing && !executionErrorStore.isErrorOverlayOpen)
        executionErrorStore.dismissErrorOverlay()
    }
  )
}
