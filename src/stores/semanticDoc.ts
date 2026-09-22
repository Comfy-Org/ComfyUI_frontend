/**
 * Semantic Yjs document registry: one `Y.Doc` per root graph.
 *
 * Slice 1 of docs/adr/CRDT-STORES-0036-yjs-backed-semantic-stores-and-remote-merge-seam.md.
 * The document's root shares are the multiplayer schema v1 roots exported by
 * `@comfyorg/comfy-multi-player` (`nodes`, `links`, `definitions`, `meta` and
 * the `__`-prefixed doc-host bookkeeping maps). Nothing here is wired to a
 * store yet; later slices re-base `nodeDataStore`, `linkStore` and
 * `widgetValueStore` onto these accessors.
 *
 * Boundaries this module keeps:
 * - No layout root (pan/zoom, groups, reroutes, viewport) is ever created
 *   here. Layout stays in `layoutStore`'s own document.
 * - Remote updates enter only through `applyRemote`, which carries provenance
 *   as the Yjs transaction origin, never on an ambient singleton.
 * - The module writes no shared state. The human write path (op-stamped local
 *   origin via `applyOps`) is a later slice.
 * - Reads never materialise a root: an absent root reads as empty rather than
 *   being created by `doc.getMap`.
 */
import {
  hasNode as cmpHasNode,
  linksMap,
  nodesMap,
  readGraph
} from '@comfyorg/comfy-multi-player'
import type { GraphSnapshot } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

const DEFINITIONS_ROOT = 'definitions'

/**
 * Provenance of a remote update, carried as the Yjs transaction origin so
 * observers can tell a merged host frame from a local human edit.
 */
export interface RemoteUpdateOrigin {
  readonly source: 'agent-remote'
  readonly actor: string
}

export function isRemoteUpdateOrigin(
  value: unknown
): value is RemoteUpdateOrigin {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<RemoteUpdateOrigin>
  return (
    candidate.source === 'agent-remote' && typeof candidate.actor === 'string'
  )
}

/** Deep change notification for the semantic roots of one root graph. */
export type SemanticDocListener = (
  events: readonly Y.YEvent<Y.AbstractType<unknown>>[],
  transaction: Y.Transaction
) => void

/**
 * Registry of semantic documents keyed by root graph. A document exists from
 * the first `ensure`/`applyRemote`/`observe` for its root graph until
 * `destroy`; reads on an unknown root graph return empty data rather than
 * creating a document.
 */
export class SemanticDocRegistry {
  private readonly docs = new Map<RootGraphId, Y.Doc>()

  /** The document for `rootGraphId`, or `undefined` if none has been created. */
  get(rootGraphId: RootGraphId): Y.Doc | undefined {
    return this.docs.get(rootGraphId)
  }

  /** The document for `rootGraphId`, creating an empty one if needed. */
  ensure(rootGraphId: RootGraphId): Y.Doc {
    const existing = this.docs.get(rootGraphId)
    if (existing) return existing
    const created = new Y.Doc()
    this.docs.set(rootGraphId, created)
    return created
  }

  has(rootGraphId: RootGraphId): boolean {
    return this.docs.has(rootGraphId)
  }

  /** Destroys the document for `rootGraphId`, detaching every observer. */
  destroy(rootGraphId: RootGraphId): void {
    const doc = this.docs.get(rootGraphId)
    if (!doc) return
    this.docs.delete(rootGraphId)
    doc.destroy()
  }

  /** Destroys every document. */
  destroyAll(): void {
    for (const rootGraphId of [...this.docs.keys()]) this.destroy(rootGraphId)
  }

  /**
   * Merges a raw host update into the semantic document for `rootGraphId`.
   * The follower never writes the shared document; this is the one-way
   * host-to-follower path, and `origin` becomes the transaction origin.
   */
  applyRemote(
    rootGraphId: RootGraphId,
    update: Uint8Array,
    origin: RemoteUpdateOrigin
  ): void {
    Y.applyUpdate(this.ensure(rootGraphId), update, origin)
  }

  /** Root-graph nodes and links as deep-frozen plain data; empty if unknown. */
  readGraph(rootGraphId: RootGraphId): GraphSnapshot {
    const doc = this.docs.get(rootGraphId)
    return doc ? readGraph(doc) : EMPTY_GRAPH
  }

  hasNode(rootGraphId: RootGraphId, nodeId: NodeId): boolean {
    const doc = this.docs.get(rootGraphId)
    return doc ? cmpHasNode(doc, nodeId) : false
  }

  /**
   * Subgraph definitions keyed by definition id, as plain data. The package
   * does not export a definitions reader, so this gates on `doc.share` to
   * avoid materialising the root on a document that never received one.
   */
  readDefinitions(rootGraphId: RootGraphId): Readonly<Record<string, unknown>> {
    const doc = this.docs.get(rootGraphId)
    if (!doc || !doc.share.has(DEFINITIONS_ROOT)) return EMPTY_RECORD
    return Object.freeze(doc.getMap(DEFINITIONS_ROOT).toJSON())
  }

  /**
   * Observes deep changes under the `nodes` and `links` roots. Attaching an
   * observer registers empty root types locally when they are absent; that
   * adds no document content and ships nothing. Returns an unsubscribe.
   */
  observe(rootGraphId: RootGraphId, listener: SemanticDocListener): () => void {
    const doc = this.ensure(rootGraphId)
    const roots = [nodesMap(doc), linksMap(doc)]
    for (const root of roots) root.observeDeep(listener)
    return () => {
      for (const root of roots) root.unobserveDeep(listener)
    }
  }
}

const EMPTY_RECORD: Readonly<Record<string, never>> = Object.freeze({})
const EMPTY_GRAPH: GraphSnapshot = Object.freeze({
  nodes: EMPTY_RECORD,
  links: EMPTY_RECORD
})

/** Process-wide registry; tests construct their own `SemanticDocRegistry`. */
export const semanticDocs = new SemanticDocRegistry()
