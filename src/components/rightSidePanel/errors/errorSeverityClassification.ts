import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type {
  ExecutionErrorWsMessage,
  NodeError,
  PromptError
} from '@/schemas/apiSchema'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'

import {
  getMissingResourceValidationErrorAbsorption,
  isMissingNodePromptErrorAbsorbed
} from './missingResourceAbsorption'

export interface ErrorSeverityInput {
  promptError: PromptError | null | undefined
  executionError: ExecutionErrorWsMessage | null | undefined
  nodeErrors: Record<string, NodeError> | null | undefined
  missingModels: readonly MissingModelCandidate[] | null | undefined
  missingMedia: readonly MissingMediaCandidate[] | null | undefined
  hasMissingNodes: boolean
}

export function classifyErrorSeverity(input: ErrorSeverityInput) {
  const promptError = input.promptError
    ? {
        error: input.promptError,
        isAbsorbed: isMissingNodePromptErrorAbsorbed(
          input.promptError,
          input.hasMissingNodes
        )
      }
    : null

  const executionError = input.executionError
    ? {
        error: input.executionError,
        nodeId: tryNormalizeNodeExecutionId(input.executionError.node_id)
      }
    : null

  const nodeErrors = Object.entries(input.nodeErrors ?? {}).map(
    ([rawNodeId, nodeError]) => {
      const nodeId = tryNormalizeNodeExecutionId(rawNodeId)
      return {
        rawNodeId,
        nodeId,
        nodeError,
        errors: nodeError.errors.map((error) => ({
          error,
          absorption: nodeId
            ? getMissingResourceValidationErrorAbsorption(
                input.missingModels,
                input.missingMedia,
                error,
                nodeId
              )
            : null
        }))
      }
    }
  )

  const hasBlockingNodeError = nodeErrors.some(({ errors }) =>
    errors.some(({ absorption }) => !absorption)
  )

  return {
    promptError,
    executionError,
    nodeErrors,
    hasBlockingError:
      (promptError !== null && !promptError.isAbsorbed) ||
      executionError !== null ||
      hasBlockingNodeError
  }
}
