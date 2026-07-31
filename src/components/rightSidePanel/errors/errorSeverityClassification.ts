import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type {
  ExecutionErrorWsMessage,
  NodeError,
  PromptError
} from '@/schemas/apiSchema'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

import {
  getMissingResourceValidationErrorAbsorption,
  isMissingNodePromptErrorAbsorbed
} from './missingResourceAbsorption'

export interface ErrorSeverityInput {
  promptError: PromptError | null | undefined
  executionError: ExecutionErrorWsMessage | null
  nodeErrors: Record<string, NodeError> | null
  missingModels: readonly MissingModelCandidate[] | null | undefined
  missingMedia: readonly MissingMediaCandidate[] | null | undefined
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
      absorption: 'missing_model' | 'missing_media' | null
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
