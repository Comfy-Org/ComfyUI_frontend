import type { NodeExecutionOutput } from '@/schemas/apiSchema'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import type { ResultItemImpl } from '@/stores/queueStore'

export function flattenNodeOutput([nodeId, nodeOutput]: [
  string | number,
  NodeExecutionOutput
]): ResultItemImpl[] {
  return parseNodeOutput(nodeId, nodeOutput)
}
