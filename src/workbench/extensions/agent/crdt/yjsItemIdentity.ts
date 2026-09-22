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
 * The Yjs item identity (`client:clock`) of `key` in `map` - present or
 * already tombstoned - or null when `key` was never set. Throws if Yjs's
 * internal shape doesn't match what this module assumes; callers use
 * {@link readNodeItemIdentity} for a reported, non-throwing boundary. Kept
 * module-private: production and test code both go through
 * {@link readNodeItemIdentity} instead.
 */
function readYjsMapItemIdentity(
  map: Y.Map<unknown>,
  key: string
): string | null {
  const item = map._map.get(key)
  return item ? `${item.id.client}:${item.id.clock}` : null
}

/**
 * `readYjsMapItemIdentity` for `doc`'s `nodes` map, reported instead of
 * thrown: a real `Y.Doc` failing this access is an unexpected break in
 * Yjs's internal shape, not an ordinary missing identity, so it is
 * surfaced via telemetry rather than folded into the same `null` result.
 */
export function readNodeItemIdentity(
  doc: Y.Doc,
  nodeId: string
): string | null {
  try {
    return readYjsMapItemIdentity(doc.getMap('nodes'), nodeId)
  } catch (error) {
    reportError(error, {
      errorType: 'failure_reading_agent_crdt_node_item_identity'
    })
    return null
  }
}
