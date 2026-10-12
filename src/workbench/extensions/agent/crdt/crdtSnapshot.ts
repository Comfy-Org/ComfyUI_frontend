/**
 * The follower's read-only view of its own document.
 *
 * Split out of `crdtDebugReport.ts` so the composable — which every agent
 * panel loads eagerly — does not pull the report collector, its redaction
 * helpers and the extension store into that bundle. Only the debug panel,
 * behind its async boundary, needs those.
 */
import {
  appliedOpIds,
  readGraph,
  readMeta,
  readStamps
} from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

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
  if (doc === null) {
    return {
      ...base,
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
      ...base,
      meta: readMeta(doc),
      nodeIds: Object.keys(graph.nodes),
      linkIds: Object.keys(graph.links),
      appliedOpIds: appliedOpIds(doc),
      stamps: readStamps(doc)
    }
  } catch (error) {
    // A doc this build cannot read (KA-11) still has to produce a report —
    // that failure IS the bug being reported.
    return {
      ...base,
      schemaError: base.schemaError ?? String(error),
      meta: {},
      nodeIds: [],
      linkIds: [],
      appliedOpIds: [],
      stamps: {}
    }
  }
}
