import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import { parseNodeOutput } from '@comfyorg/api-client/results/resultItemParsing'
import type { AugmentedResultItem } from '@comfyorg/api-client/results/resultItem'

export function flattenNodeOutput([nodeId, nodeOutput]: [
  string | number,
  NodeExecutionOutput | null | undefined
]): AugmentedResultItem[] {
  return parseNodeOutput(nodeId, nodeOutput)
}
