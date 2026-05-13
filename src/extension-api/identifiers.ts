/**
 * Node identity helpers — re-exported from internal `nodeIdentification.ts`.
 *
 * `NodeLocatorId` and `NodeExecutionId` are the two stable node identity
 * primitives in the public API. All extension-facing code that needs to
 * reference a node across subgraph boundaries or execution runs should use
 * these rather than raw LiteGraph integer node IDs.
 *
 * @packageDocumentation
 */

export type { NodeLocatorId, NodeExecutionId } from '@/types/nodeIdentification'

export {
  isNodeLocatorId,
  isNodeExecutionId,
  parseNodeLocatorId,
  createNodeLocatorId,
  parseNodeExecutionId,
  createNodeExecutionId
} from '@/types/nodeIdentification'
