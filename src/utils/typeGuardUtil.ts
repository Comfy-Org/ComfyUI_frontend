import type {
  INodeSlot,
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import type { ResultItemType } from '@/schemas/apiSchema'

/**
 * Check if an error was triggered by `AbortController#abort` when cancelling a
 * request. `fetch` rejects with a `DOMException`; axios rejects with its own
 * `CanceledError`, which is an `AxiosError` carrying `code: 'ERR_CANCELED'`
 * rather than a `DOMException`. Duck-typed rather than delegated to
 * `axios.isCancel` so this leaf util stays usable under `vi.mock('axios')`.
 */
export const isAbortError = (err: unknown): boolean => {
  if (err instanceof DOMException) return err.name === 'AbortError'
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'ERR_CANCELED'
  )
}

export const isSubgraph = (
  item: LGraph | Subgraph | undefined | null
): item is Subgraph => item?.isRootGraph === false

/**
 * Check if an item is non-nullish.
 */
export const isNonNullish = <T>(item: T | undefined | null): item is T =>
  item != null

/**
 * Type guard to check if a node is a subgraph input/output node.
 * These nodes are essential to subgraph structure and should not be removed.
 */
export const isSubgraphIoNode = (
  node: Omit<LGraphNode, 'constructor'> & {
    constructor?: LGraphNode['constructor']
  }
): node is LGraphNode & {
  constructor: { comfyClass: 'SubgraphInputNode' | 'SubgraphOutputNode' }
} => {
  const nodeClass = node.constructor?.comfyClass
  return nodeClass === 'SubgraphInputNode' || nodeClass === 'SubgraphOutputNode'
}

/**
 * Type guard for slot objects (inputs/outputs)
 */
export const isSlotObject = (obj: unknown): obj is INodeSlot => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'name' in obj &&
    'type' in obj &&
    'boundingRect' in obj
  )
}

/**
 * Type guard to check if a string is a valid ResultItemType
 * ResultItemType is used for asset categorization (input/output/temp)
 */
export const isResultItemType = (
  value: string | undefined
): value is ResultItemType => {
  return value === 'input' || value === 'output' || value === 'temp'
}
