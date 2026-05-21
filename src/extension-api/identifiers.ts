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

/**
 * Node identity round-trip helpers. Create/parse branded `NodeLocatorId` and
 * `NodeExecutionId` values, or narrow an `unknown` to one with the type
 * guards. Use these instead of raw string manipulation so future changes to
 * the identity scheme stay transparent.
 *
 * @example
 * ```ts
 * import {
 *   createNodeLocatorId,
 *   parseNodeLocatorId,
 *   isNodeLocatorId,
 *   createNodeExecutionId,
 *   parseNodeExecutionId,
 *   isNodeExecutionId
 * } from '@comfyorg/extension-api'
 *
 * // Construct
 * const locator = createNodeLocatorId(graphUuid, localId)
 * const execId = createNodeExecutionId(locator, runTag)
 *
 * // Narrow
 * if (isNodeLocatorId(maybe)) {
 *   const parts = parseNodeLocatorId(maybe)
 *   console.log(parts.graphUuid, parts.localId)
 * }
 *
 * if (isNodeExecutionId(maybe)) {
 *   const parts = parseNodeExecutionId(maybe)
 *   console.log(parts.locator, parts.runTag)
 * }
 * ```
 */
export {
  isNodeLocatorId,
  isNodeExecutionId,
  parseNodeLocatorId,
  createNodeLocatorId,
  parseNodeExecutionId,
  createNodeExecutionId
} from '@/types/nodeIdentification'
