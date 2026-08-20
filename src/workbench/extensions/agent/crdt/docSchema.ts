/**
 * Follower-owned reader for the CRDT semantic doc (schema v1).
 *
 * This is the ONLY schema-aware code on the follower. It mirrors the
 * `@comfyorg/comfy-multi-player` doc layout (root maps `nodes` / `links`,
 * per-node `type` / `pos` / `widgets`) using raw `yjs`, because FE consumption
 * of that package is an unresolved product decision (ADR-009). When the FE
 * adopts the package, replace `readDocSnapshot` with its `nodesMap` / `linksMap`
 * / `project` helpers; the diff and mutator stay unchanged. The shape is pinned
 * by `docSchema.test.ts` so drift is caught mechanically.
 *
 * Schema v1 (docs/multiplayer-schema.md §1, comfy-multi-player docs/INVARIANTS):
 *   doc
 *   ├── Y.Map 'nodes'  key String(id) → Y.Map { type, pos:number[],
 *   │                    widgets: Y.Map name→value | '__widgets_opaque': array,
 *   │                    inputs/outputs: Y.Array, flags: Y.Map, … }
 *   └── Y.Map 'links'  key String(id) → tuple [id, originId, originSlot,
 *                        targetId, targetSlot, type]
 */
import * as Y from 'yjs'

import { toNodeId } from '@/types/nodeId'

import type { LinkId, LinkSpec, NodeSpec } from './graphMutations'

export const NODES_KEY = 'nodes'
export const LINKS_KEY = 'links'
export const WIDGETS_KEY = 'widgets'
export const OPAQUE_WIDGETS_KEY = '__widgets_opaque'

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
  const ynodes = doc.getMap<Y.Map<unknown>>(NODES_KEY)
  ynodes.forEach((node, id) => {
    if (!(node instanceof Y.Map)) return
    const spec = readNode(id, node)
    if (spec) nodes.set(id, spec)
  })

  const links = new Map<LinkId, LinkSpec>()
  const ylinks = doc.getMap<unknown>(LINKS_KEY)
  ylinks.forEach((raw, id) => {
    const spec = readLink(id, raw)
    if (spec) links.set(id, spec)
  })

  return { nodes, links }
}
