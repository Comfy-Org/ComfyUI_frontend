/**
 * Public API for node event subscriptions.
 *
 * Exposed via window.comfyAPI.nodeEvents for custom node extensions.
 *
 * Usage:
 *   const { NodeEvent, onAllNodeEvents, offAllNodeEvents } = window.comfyAPI.nodeEvents
 *
 *   // In beforeRegisterNodeDef:
 *   onAllNodeEvents(nodeType, NodeEvent.EXECUTED, function(detail) {
 *     // `this` is the node instance
 *     console.log('Node executed:', detail.output)
 *   })
 */
export { NodeEvent } from '@/lib/litegraph/src/infrastructure/LGraphNodeEventMap'
export {
  onAllNodeEvents,
  offAllNodeEvents
} from '@/lib/litegraph/src/infrastructure/NodeEventEmitter'
