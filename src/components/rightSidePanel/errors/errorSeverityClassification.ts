import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

import type {
  ExecutionErrorWsMessage,
  NodeError,
  PromptError
} from './errorsWsTypes'
import {
  classifyValidationErrorAbsorption,
  isMissingNodePromptErrorAbsorbed
} from './missingResourceAbsorption'
import type { MissingResourceAbsorption } from './missingResourceAbsorption'

export interface ErrorSeverityInput {
  promptError: PromptError | null
  executionError: ExecutionErrorWsMessage | null
  nodeErrors: Record<string, NodeError> | null
  missingModels: readonly MissingModelCandidate[] | null
  missingMedia: readonly MissingMediaCandidate[] | null
  hasMissingNodes: boolean
}

export interface ErrorClassification {
  promptError: {
    error: PromptError
    isAbsorbed: boolean
  } | null
  executionError: {
    error: ExecutionErrorWsMessage
    nodeId: NodeExecutionId | null
  } | null
  nodeErrors: {
    rawNodeId: string
    nodeId: NodeExecutionId | null
    nodeError: NodeError
    errors: {
      error: NodeValidationError
      absorption: MissingResourceAbsorption | null
    }[]
  }[]
  hasBlockingError: boolean
}

export function classifyPanelErrors(
  input: ErrorSeverityInput
): ErrorClassification {
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
        nodeId:
          input.executionError.node_id == null
            ? null
            : tryNormalizeNodeExecutionId(input.executionError.node_id)
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
            ? classifyValidationErrorAbsorption(
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
