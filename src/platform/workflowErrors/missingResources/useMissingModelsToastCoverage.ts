import { computed } from 'vue'

import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { isCoveredByMissingModelsToast } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'

/** Reactive coverage of the workflow's issues by the Desktop missing resources toast. */
export function useMissingModelsToastCoverage() {
  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const missingNodesStore = useMissingNodesErrorStore()
  const missingMediaStore = useMissingMediaStore()
  const downloadStore = useMissingModelDownloadStore()

  const coveredByToast = computed(() =>
    isCoveredByMissingModelsToast({
      toastActive: downloadStore.tracksHostProgress(),
      missingModels: missingModelStore.hasMissingModels,
      missingNodes: missingNodesStore.hasMissingNodes,
      missingMedia: missingMediaStore.hasMissingMedia,
      runErrors:
        executionErrorStore.hasExecutionError ||
        executionErrorStore.hasPromptError ||
        executionErrorStore.hasNodeError
    })
  )

  return { coveredByToast }
}
