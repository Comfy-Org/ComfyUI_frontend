import { computed } from 'vue'

import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'

import {
  getMissingResourceValidationErrorAbsorption,
  isMissingNodePromptErrorAbsorbed
} from './missingResourceAbsorption'

export function useHasBlockingError() {
  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const missingMediaStore = useMissingMediaStore()
  const missingNodesStore = useMissingNodesErrorStore()

  return computed(() => {
    const promptError = executionErrorStore.lastPromptError
    if (
      (promptError &&
        !isMissingNodePromptErrorAbsorbed(
          promptError,
          missingNodesStore.hasMissingNodes
        )) ||
      (executionErrorStore.lastExecutionError &&
        tryNormalizeNodeExecutionId(
          executionErrorStore.lastExecutionError.node_id
        ))
    ) {
      return true
    }

    return Object.entries(executionErrorStore.surfacedNodeErrors ?? {}).some(
      ([rawNodeId, nodeError]) => {
        const nodeId = tryNormalizeNodeExecutionId(rawNodeId)
        if (!nodeId) return false

        return nodeError.errors.some(
          (error) =>
            getMissingResourceValidationErrorAbsorption(
              missingModelStore.missingModelCandidates,
              missingMediaStore.missingMediaCandidates,
              error,
              nodeId
            ) === null
        )
      }
    )
  })
}
