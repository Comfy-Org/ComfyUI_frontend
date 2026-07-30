import { computed } from 'vue'

import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

import { classifyErrorSeverity } from './errorSeverityClassification'

export function useHasBlockingError() {
  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const missingMediaStore = useMissingMediaStore()
  const missingNodesStore = useMissingNodesErrorStore()

  return computed(
    () =>
      classifyErrorSeverity({
        promptError: executionErrorStore.lastPromptError,
        executionError: executionErrorStore.lastExecutionError,
        nodeErrors: executionErrorStore.surfacedNodeErrors,
        missingModels: missingModelStore.missingModelCandidates,
        missingMedia: missingMediaStore.missingMediaCandidates,
        hasMissingNodes: missingNodesStore.hasMissingNodes
      }).hasBlockingError
  )
}
