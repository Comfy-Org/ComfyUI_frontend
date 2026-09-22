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
 * - Local writes enter only through `transactLocal`, whose `LocalUpdateOrigin`
 *   carries the op stamp (`actor`, `opId`) when the caller has one. Nothing is
 *   shipped anywhere; the human write path that stamps ops is a later slice.
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

import { toOwningGraphId } from '@/types/graphScopeId'
import type { OwningGraphId, RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

const DEFINITIONS_ROOT = 'definitions'

/**
 * The two owner-partitioned collections of the semantic schema. The root graph
 * owns the `nodes` and `links` root shares; a subgraph definition owns
 * `definitions.<id>.nodes` and `definitions.<id>.links`.
 */
export type OwnedCollection = 'nodes' | 'links'

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

/**
 * Provenance of a local write, carried as the Yjs transaction origin. The op
 * stamp is optional until the human write path lands; a store projection that
 * mirrors an already-stamped mutation forwards `actor` and `opId` unchanged.
 */
export interface LocalUpdateOrigin {
  readonly source: 'local'
  readonly actor?: string
  readonly opId?: string
}

export function isLocalUpdateOrigin(
  value: unknown
): value is LocalUpdateOrigin {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<LocalUpdateOrigin>
  return (
    candidate.source === 'local' &&
    (candidate.actor === undefined || typeof candidate.actor === 'string') &&
    (candidate.opId === undefined || typeof candidate.opId === 'string')
  )
}

function isRootOwner(
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId
): boolean {
  return (owningGraphId as string) === (rootGraphId as string)
}

function rootCollection(doc: Y.Doc, collection: OwnedCollection) {
  return (
    collection === 'nodes' ? nodesMap(doc) : linksMap(doc)
  ) as Y.Map<unknown>
}

/**
 * The map that owns `collection` entries of `owningGraphId` inside the
 * document of `rootGraphId`: the root share when the owner is the root graph,
 * otherwise `definitions.<owner>.<collection>`. With `create: false` an
 * absent definition path reads as `undefined` instead of being materialised.
 */
function ownerMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  collection: OwnedCollection,
  create: true
): Y.Map<unknown>
function ownerMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  collection: OwnedCollection,
  create: false
): Y.Map<unknown> | undefined
function ownerMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  collection: OwnedCollection,
  create: boolean
): Y.Map<unknown> | undefined {
  if (isRootOwner(rootGraphId, owningGraphId)) {
    return rootCollection(doc, collection)
  }
  if (!create && !doc.share.has(DEFINITIONS_ROOT)) return undefined
  const definitions = doc.getMap<unknown>(DEFINITIONS_ROOT)
  let definition = definitions.get(owningGraphId)
  if (!(definition instanceof Y.Map)) {
    if (!create) return undefined
    definition = new Y.Map<unknown>()
    definitions.set(owningGraphId, definition)
  }
  let owned = (definition as Y.Map<unknown>).get(collection)
  if (!(owned instanceof Y.Map)) {
    if (!create) return undefined
    owned = new Y.Map<unknown>()
    ;(definition as Y.Map<unknown>).set(collection, owned)
  }
  return owned as Y.Map<unknown>
}

/** {@link ownerMap} for the `nodes` collection. */
export function ownerNodesMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  create: true
): Y.Map<unknown>
export function ownerNodesMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  create: false
): Y.Map<unknown> | undefined
export function ownerNodesMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  create: boolean
): Y.Map<unknown> | undefined {
  return create
    ? ownerMap(doc, rootGraphId, owningGraphId, 'nodes', true)
    : ownerMap(doc, rootGraphId, owningGraphId, 'nodes', false)
}

/**
 * {@link ownerMap} for the `links` collection. Root links are the
 * `LinkTuple` values the package's `linksMap` exposes; definition links live
 * at `definitions.<owner>.links`, keyed by `String(linkId)` like the root.
 */
export function ownerLinksMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  create: true
): Y.Map<unknown>
export function ownerLinksMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  create: false
): Y.Map<unknown> | undefined
export function ownerLinksMap(
  doc: Y.Doc,
  rootGraphId: RootGraphId,
  owningGraphId: OwningGraphId,
  create: boolean
): Y.Map<unknown> | undefined {
  return create
    ? ownerMap(doc, rootGraphId, owningGraphId, 'links', true)
    : ownerMap(doc, rootGraphId, owningGraphId, 'links', false)
}

/**
 * Every subgraph definition that currently owns a `collection` map, without
 * materialising the `definitions` root or any missing path.
 */
export function definitionOwnerMaps(
  doc: Y.Doc,
  collection: OwnedCollection
): [OwningGraphId, Y.Map<unknown>][] {
  if (!doc.share.has(DEFINITIONS_ROOT)) return []
  const owners: [OwningGraphId, Y.Map<unknown>][] = []
  for (const [definitionId, definition] of doc.getMap(DEFINITIONS_ROOT)) {
    if (!(definition instanceof Y.Map)) continue
    const owned = definition.get(collection)
    if (owned instanceof Y.Map)
      owners.push([toOwningGraphId(definitionId), owned])
  }
  return owners
}

/**
 * Receives owner membership projected from a semantic document by
 * {@link SemanticDocRegistry.projectMembership}. Ids arrive as the document's
 * string keys; the store brands them.
 */
export interface MembershipSink {
  add(owningGraphId: OwningGraphId, id: string): void
  remove(owningGraphId: OwningGraphId, id: string): void
  /**
   * Drops every non-root owner. Called before the definitions are re-seeded
   * when a definition (or its owned map) is added, replaced or removed.
   */
  resetDefinitionOwners(): void
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

  /**
   * Runs `fn` as one local transaction on the document for `rootGraphId`,
   * with `origin` as the transaction origin. Every local write to a semantic
   * root goes through here so observers can separate it from `applyRemote`.
   */
  transactLocal(
    rootGraphId: RootGraphId,
    origin: LocalUpdateOrigin,
    fn: (doc: Y.Doc) => void
  ): void {
    const doc = this.ensure(rootGraphId)
    doc.transact(() => fn(doc), origin)
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

  /**
   * Observes deep changes under the `nodes` and `definitions` roots, i.e.
   * every map that can own a node (see `ownerNodesMap`). Unlike `observe`,
   * this registers an empty `definitions` root locally when absent; like
   * `observe`, that adds no content and ships nothing. Returns an unsubscribe.
   */
  observeNodes(
    rootGraphId: RootGraphId,
    listener: SemanticDocListener
  ): () => void {
    return this.observeOwners(rootGraphId, 'nodes', listener)
  }

  /**
   * Observes deep changes under the `links` and `definitions` roots, i.e.
   * every map that can own a link (see `ownerLinksMap`). Same root
   * registration caveat as `observeNodes`. Returns an unsubscribe.
   */
  observeLinks(
    rootGraphId: RootGraphId,
    listener: SemanticDocListener
  ): () => void {
    return this.observeOwners(rootGraphId, 'links', listener)
  }

  private observeOwners(
    rootGraphId: RootGraphId,
    collection: OwnedCollection,
    listener: SemanticDocListener
  ): () => void {
    const doc = this.ensure(rootGraphId)
    const roots = [
      rootCollection(doc, collection),
      doc.getMap<unknown>(DEFINITIONS_ROOT)
    ]
    for (const root of roots) root.observeDeep(listener)
    return () => {
      for (const root of roots) root.unobserveDeep(listener)
    }
  }

  /**
   * Projects owner membership of `collection` from the document of
   * `rootGraphId` into `sink`: seeds the sink from the current document, then
   * forwards key additions and deletions under the root share and every
   * `definitions.<owner>.<collection>` map. A change to the `definitions`
   * root itself, or to a definition entry, resets and re-seeds every
   * non-root owner. Returns an unsubscribe; the sink is not cleared by it.
   */
  projectMembership(
    rootGraphId: RootGraphId,
    collection: OwnedCollection,
    sink: MembershipSink
  ): () => void {
    const doc = this.ensure(rootGraphId)
    const rootOwner = toOwningGraphId(rootGraphId)
    const root = rootCollection(doc, collection)
    const definitions = doc.getMap<unknown>(DEFINITIONS_ROOT)

    const seed = (owningGraphId: OwningGraphId, owned: Y.Map<unknown>) => {
      for (const id of owned.keys()) sink.add(owningGraphId, id)
    }
    const reseedDefinitions = () => {
      sink.resetDefinitionOwners()
      for (const [owningGraphId, owned] of definitionOwnerMaps(doc, collection))
        seed(owningGraphId, owned)
    }
    const applyKeyChanges = (
      owningGraphId: OwningGraphId,
      event: Y.YEvent<Y.AbstractType<unknown>>
    ) => {
      for (const [id, change] of event.changes.keys) {
        if (change.action === 'delete') sink.remove(owningGraphId, id)
        else sink.add(owningGraphId, id)
      }
    }

    seed(rootOwner, root)
    for (const [owningGraphId, owned] of definitionOwnerMaps(doc, collection))
      seed(owningGraphId, owned)

    return this.observeOwners(rootGraphId, collection, (events) => {
      for (const event of events) {
        if (event.currentTarget === root) {
          if (event.target === root) applyKeyChanges(rootOwner, event)
          continue
        }
        if (event.currentTarget !== definitions) continue
        const path = event.path
        if (path.length <= 1) {
          reseedDefinitions()
          continue
        }
        if (path.length === 2 && path[1] === collection) {
          applyKeyChanges(toOwningGraphId(String(path[0])), event)
        }
      }
    })
  }
}

const EMPTY_RECORD: Readonly<Record<string, never>> = Object.freeze({})
const EMPTY_GRAPH: GraphSnapshot = Object.freeze({
  nodes: EMPTY_RECORD,
  links: EMPTY_RECORD
})

/** Process-wide registry; tests construct their own `SemanticDocRegistry`. */
export const semanticDocs = new SemanticDocRegistry()
