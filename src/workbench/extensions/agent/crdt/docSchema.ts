/**
 * Follower-owned reader for the CRDT semantic doc (schema v1).
 *
 * This is the ONLY schema-aware code on the follower. It consumes
 * `@comfyorg/comfy-multi-player` — the ONE shared applier/doc package, pinned to
 * an EXACT public-npm version and imported identically by the cloud doc-host
 * (`Comfy-Org/cloud`, `services/agent/dochost`, which pins the same `0.1.0`) —
 * for the doc layout: the root-map accessors (`nodesMap` / `linksMap`) and the
 * reserved opaque-widgets key. It deliberately does NOT import
 * `applyOps` / `project` — a follower never writes the shared doc (CRDT
 * invariant #6), it only reads root maps into a plain FE-domain snapshot.
 * Reading via the package's `nodesMap`/`linksMap` (thin `doc.getMap` wrappers)
 * produces no Yjs struct update, so the follower stays read-only.
 *
 * FE consumption is RESOLVED (was ADR-009): the package installs cleanly from
 * the public registry (both `dist` types and runtime) with no credential, so key
 * names / schema version can no longer drift from the host — they are the same
 * symbols. `0.1.0` is the published build of what was previously pinned as git
 * SHA `6793d754`; the two share an identical `src/` tree, so the registry switch
 * changed the transport and nothing else. NOTE `0.1.0` predates the package's
 * fail-closed hardening (schema-version-on-read, encodability predicate, payload
 * bounds, read-only snapshot surface) — those are on its `main`, unpublished.
 * The
 * remaining local constants (`NODES_KEY`/`LINKS_KEY`/`WIDGETS_KEY`) mirror the
 * layout the package encodes in `nodesMap`/`linksMap`/`createNodeMap` (it does
 * not export those names as constants); `docSchema.test.ts` pins them.
 *
 * Schema v1 (docs/multiplayer-schema.md §1, comfy-multi-player docs/INVARIANTS):
 *   doc
 *   ├── Y.Map 'nodes'  key String(id) → Y.Map { type, pos:number[],
 *   │                    widgets: Y.Map name→value | '__widgets_opaque': array,
 *   │                    inputs/outputs: Y.Array, flags: Y.Map, … }
 *   └── Y.Map 'links'  key String(id) → tuple [id, originId, originSlot,
 *                        targetId, targetSlot, type]
 */
import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { toNodeId } from '@/types/nodeId'

import type { LinkId, LinkSpec, NodeSpec } from './graphMutations'

export const NODES_KEY = 'nodes'
export const LINKS_KEY = 'links'
export const WIDGETS_KEY = 'widgets'
export { OPAQUE_WIDGETS_KEY }

export interface DocSnapshot {
  readonly nodes: ReadonlyMap<string, NodeSpec>
  readonly links: ReadonlyMap<LinkId, LinkSpec>
}

export const EMPTY_SNAPSHOT: DocSnapshot = {
  nodes: new Map<string, NodeSpec>(),
  links: new Map<LinkId, LinkSpec>()
}

function readPos(raw: unknown): readonly [number, number] {
  const arr = raw instanceof Y.Array ? raw.toArray() : raw
  if (Array.isArray(arr) && arr.length >= 2) {
    const x = Number(arr[0])
    const y = Number(arr[1])
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y]
  }
  return [0, 0]
}

function readWidgets(node: Y.Map<unknown>): Readonly<Record<string, unknown>> {
  const named = node.get(WIDGETS_KEY)
  if (named instanceof Y.Map) {
    const out: Record<string, unknown> = {}
    named.forEach((value, name) => {
      out[name] = value instanceof Y.Map ? value.toJSON() : value
    })
    return out
  }
  const opaque = node.get(OPAQUE_WIDGETS_KEY)
  if (Array.isArray(opaque)) {
    const out: Record<string, unknown> = {}
    opaque.forEach((value, index) => {
      out[String(index)] = value
    })
    return out
  }
  return {}
}

function readNode(id: string, node: Y.Map<unknown>): NodeSpec | null {
  const type = node.get('type')
  if (typeof type !== 'string' || type.length === 0) return null
  return {
    id: toNodeId(id),
    type,
    pos: readPos(node.get('pos')),
    widgets: readWidgets(node)
  }
}

function readLink(id: string, raw: unknown): LinkSpec | null {
  const tuple = raw instanceof Y.Array ? raw.toArray() : raw
  if (!Array.isArray(tuple) || tuple.length < 5) return null
  const originId = tuple[1]
  const targetId = tuple[3]
  if (originId == null || targetId == null) return null
  return {
    id,
    originId: toNodeId(originId as string | number),
    originSlot: Number(tuple[2]) || 0,
    targetId: toNodeId(targetId as string | number),
    targetSlot: Number(tuple[4]) || 0
  }
}

/**
 * Read the whole doc into a plain, comparable snapshot. Pure with respect to the
 * doc (no mutation). Root-graph nodes/links only; subgraph definitions and
 * reroutes are out of POC scope (ADR-009).
 */
export function readDocSnapshot(doc: Y.Doc): DocSnapshot {
  const nodes = new Map<string, NodeSpec>()
  nodesMap(doc).forEach((node, id) => {
    if (!(node instanceof Y.Map)) return
    const spec = readNode(id, node)
    if (spec) nodes.set(id, spec)
  })

  const links = new Map<LinkId, LinkSpec>()
  linksMap(doc).forEach((raw, id) => {
    const spec = readLink(id, raw)
    if (spec) links.set(id, spec)
  })

  return { nodes, links }
}
