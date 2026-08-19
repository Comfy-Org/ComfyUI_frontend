import { computed } from 'vue'

import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

import { classifyPanelErrors } from './errorSeverityClassification'

export function useErrorClassification() {
  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const missingMediaStore = useMissingMediaStore()
  const missingNodesStore = useMissingNodesErrorStore()

  return computed(() =>
    classifyPanelErrors({
      promptError: executionErrorStore.lastPromptError,
      executionError: executionErrorStore.lastExecutionError,
      nodeErrors: executionErrorStore.surfacedNodeErrors,
      missingModels: missingModelStore.missingModelCandidates,
      missingMedia: missingMediaStore.missingMediaCandidates,
      hasMissingNodes: missingNodesStore.hasMissingNodes
    })
  )
}
