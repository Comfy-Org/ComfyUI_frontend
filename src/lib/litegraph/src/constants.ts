import { toNodeId } from '@/types/nodeId'

/**
 * Subgraph constants
 *
 * This entire module is exported as `Constants`.
 */

/** ID of the virtual input node of a subgraph. */
export const SUBGRAPH_INPUT_ID = toNodeId(-10)

/** ID of the virtual output node of a subgraph. */
export const SUBGRAPH_OUTPUT_ID = toNodeId(-20)
