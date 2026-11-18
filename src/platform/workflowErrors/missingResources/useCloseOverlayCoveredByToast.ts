import { computed, watch } from 'vue'

import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { isCoveredByMissingModelsToast } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

/** Closes the error overlay whenever the visible missing resources toast already lists every issue it would show. */
export function useCloseOverlayCoveredByToast(toastVisible: () => boolean) {
  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const missingNodesStore = useMissingNodesErrorStore()
  const missingMediaStore = useMissingMediaStore()

  const coveredByToast = computed(() =>
    isCoveredByMissingModelsToast({
      toastVisible: toastVisible(),
      missingModels: missingModelStore.hasMissingModels,
      missingNodes: missingNodesStore.hasMissingNodes,
      missingMedia:
        (missingMediaStore.visibleMissingMediaCandidates?.length ?? 0) > 0,
      blockingErrors: executionErrorStore.errorClassification.hasBlockingError
    })
  )

  watch(
    () => executionErrorStore.isErrorOverlayOpen && coveredByToast.value,
    (overlayRepeatsToast) => {
      if (overlayRepeatsToast) executionErrorStore.dismissErrorOverlay()
    },
    { immediate: true }
  )
}
