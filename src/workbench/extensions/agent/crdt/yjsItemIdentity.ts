/**
 * Isolates the one place the agent CRDT follower reaches past Yjs's public
 * `Y.Map` API into its internal `_map`/`Item.id` storage to read a map
 * entry's *identity* rather than its current value: the public API returns
 * values only, and neither `_map` nor `Item.id` is part of the documented
 * contract Yjs promises to keep across versions. `yjsItemIdentity.test.ts`
 * pins this module's assumption against the real library, so a Yjs upgrade
 * that breaks it fails loudly there instead of this module silently
 * mis-attributing a deleted node's identity.
 */
import type * as Y from 'yjs'

import { reportError } from '@/platform/telemetry/reportError'

/**
 * The Yjs item identity (`client:clock`) of `nodeId` in `doc`'s `nodes` map
 * - present or already tombstoned - or null when never set. Reported
 * instead of thrown: a real `Y.Doc` failing this access is an unexpected
 * break in Yjs's internal shape, not an ordinary missing identity.
 */
export function readNodeItemIdentity(
  doc: Y.Doc,
  nodeId: string
): string | null {
  try {
    // `_map`/`Item.id` are Yjs internals the public `Y.Map` API does not
    // expose; the public API returns values only, never identity.
    const item = doc.getMap('nodes')._map.get(nodeId)
    return item ? `${item.id.client}:${item.id.clock}` : null
  } catch (error) {
    reportError(error, {
      errorType: 'failure_reading_agent_crdt_node_item_identity'
    })
    return null
  }
}
