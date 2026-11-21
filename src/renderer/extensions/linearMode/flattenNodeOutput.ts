import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import type { AugmentedResultItem } from '@/utils/resultItem'

export function flattenNodeOutput([nodeId, nodeOutput]: [
  string | number,
  NodeExecutionOutput | null | undefined
]): AugmentedResultItem[] {
  return parseNodeOutput(nodeId, nodeOutput)
}
