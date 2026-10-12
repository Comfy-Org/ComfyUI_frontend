import {
  appliedOpIds,
  readGraph,
  readMeta,
  readStamps
} from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'
import { sanitizeSecrets } from '@/platform/telemetry/redact'

import type { AgentCrdtStatus } from './useAgentCrdtFollower'

/** Live CRDT internals, read from the follower at the moment Copy is pressed. */
export interface CrdtDebugSnapshot {
  status: AgentCrdtStatus
  tabId: string | null
  lastSeq: number | null
  schemaError: string | null
  meta: Readonly<Record<string, unknown>>
  nodeIds: readonly string[]
  linkIds: readonly string[]
  appliedOpIds: readonly string[]
  stamps: Readonly<Record<string, unknown>>
}

/**
 * Read every CRDT-observable fact out of a follower doc.
 *
 * Uses the package's read-only snapshot surface rather than the live Y types:
 * those accessors never materialize a root on an empty document and never hand
 * back a writable handle, so building a report can never perturb the thing it
 * is reporting on.
 */
export function readCrdtSnapshot(
  doc: Y.Doc | null,
  base: Omit<
    CrdtDebugSnapshot,
    'meta' | 'nodeIds' | 'linkIds' | 'appliedOpIds' | 'stamps'
  >
): CrdtDebugSnapshot {
  const snapshot = {
    ...base,
    schemaError:
      base.schemaError === null
        ? null
        : String(sanitizeSecrets(base.schemaError))
  }
  if (doc === null) {
    return {
      ...snapshot,
      meta: {},
      nodeIds: [],
      linkIds: [],
      appliedOpIds: [],
      stamps: {}
    }
  }
  try {
    const graph = readGraph(doc)
    return {
      ...snapshot,
      meta: sanitizeSecrets(readMeta(doc)),
      nodeIds: Object.keys(graph.nodes),
      linkIds: Object.keys(graph.links),
      appliedOpIds: appliedOpIds(doc),
      stamps: sanitizeSecrets(readStamps(doc))
    }
  } catch (error) {
    return {
      ...snapshot,
      schemaError:
        snapshot.schemaError ?? String(sanitizeSecrets(String(error))),
      meta: {},
      nodeIds: [],
      linkIds: [],
      appliedOpIds: [],
      stamps: {}
    }
  }
}
