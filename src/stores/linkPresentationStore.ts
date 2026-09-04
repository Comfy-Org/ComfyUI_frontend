import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { LinkId } from '@/types/linkId'

/** Durable presentation state for a link: endpoint-badge visibility and custom label. */
export interface LinkPresentation {
  hidden?: boolean
  label?: string
}

/**
 * Patch semantics: a key present with value `undefined` clears that field; an
 * absent key leaves the field unchanged.
 */
export type LinkPresentationPatch = LinkPresentation

export function isDefaultLinkPresentation(
  hidden: boolean | undefined,
  label: string | undefined
): boolean {
  return !hidden && label === undefined
}

export function compactLinkPresentation(
  hidden: boolean | undefined,
  label: string | undefined
): LinkPresentation | undefined {
  if (isDefaultLinkPresentation(hidden, label)) return undefined
  return {
    ...(hidden && { hidden: true }),
    ...(label !== undefined && { label })
  }
}

interface OwnedLinkPresentation {
  graphId: OwningGraphId
  presentation: LinkPresentation
}

interface RootPresentationBucket {
  byId: Map<LinkId, OwnedLinkPresentation>
  idsByOwner: Map<OwningGraphId, Set<LinkId>>
}

const EMPTY_IDS: readonly LinkId[] = []

/**
 * Link presentation store, partitioned by root graph and keyed by link id —
 * the durable sidecar of the link topology store for non-topology link state
 * (`extra.linkPresentation` in the wire format). Entries exist only for links
 * with non-default presentation, so the store's contents are exactly the
 * serialization set.
 */
export const useLinkPresentationStore = defineStore('linkPresentation', () => {
  const roots = reactive(new Map<RootGraphId, RootPresentationBucket>())

  function createRootBucket(rootGraphId: RootGraphId): RootPresentationBucket {
    const created = reactive<RootPresentationBucket>({
      byId: new Map(),
      idsByOwner: new Map()
    })
    roots.set(rootGraphId, created)
    return created
  }

  function index(
    bucket: RootPresentationBucket,
    entry: OwnedLinkPresentation,
    linkId: LinkId
  ): void {
    const ownerIds = bucket.idsByOwner.get(entry.graphId)
    if (ownerIds) ownerIds.add(linkId)
    else bucket.idsByOwner.set(entry.graphId, reactive(new Set([linkId])))
  }

  function displace(
    rootGraphId: RootGraphId,
    bucket: RootPresentationBucket,
    linkId: LinkId,
    graphId: OwningGraphId
  ): void {
    bucket.byId.delete(linkId)
    const ownerIds = bucket.idsByOwner.get(graphId)
    ownerIds?.delete(linkId)
    if (ownerIds?.size === 0) bucket.idsByOwner.delete(graphId)
    if (bucket.byId.size === 0) roots.delete(rootGraphId)
  }

  /** First writer owns the entry; a different owner cannot overwrite it. */
  function patch(
    scope: GraphScope,
    linkId: LinkId,
    partial: LinkPresentationPatch,
    _context?: RemoteMutationContext
  ): void {
    const bucket = roots.get(scope.rootGraphId)
    const incumbent = bucket?.byId.get(linkId)
    if (incumbent && incumbent.graphId !== scope.owningGraphId) {
      console.error(
        `[linkPresentationStore] Link ${linkId} presentation belongs to graph ${incumbent.graphId}; graph ${scope.owningGraphId} cannot overwrite it.`
      )
      return
    }
    const hidden =
      'hidden' in partial ? partial.hidden : incumbent?.presentation.hidden
    const label =
      'label' in partial ? partial.label : incumbent?.presentation.label
    const compacted = compactLinkPresentation(hidden, label)
    if (!compacted) {
      if (bucket && incumbent) {
        displace(scope.rootGraphId, bucket, linkId, incumbent.graphId)
      }
      return
    }
    const target = bucket ?? createRootBucket(scope.rootGraphId)
    const entry = { graphId: scope.owningGraphId, presentation: compacted }
    target.byId.set(linkId, entry)
    index(target, entry, linkId)
  }

  /** For stashing presentation across a transfer. */
  function take(
    scope: GraphScope,
    linkId: LinkId,
    _context?: RemoteMutationContext
  ): LinkPresentation | undefined {
    const bucket = roots.get(scope.rootGraphId)
    const entry = bucket?.byId.get(linkId)
    if (!bucket || !entry || entry.graphId !== scope.owningGraphId) return
    displace(scope.rootGraphId, bucket, linkId, entry.graphId)
    return entry.presentation
  }

  function getPresentation(
    scope: GraphScope,
    linkId: LinkId
  ): Readonly<LinkPresentation> | undefined {
    const entry = roots.get(scope.rootGraphId)?.byId.get(linkId)
    return entry?.graphId === scope.owningGraphId
      ? entry.presentation
      : undefined
  }

  function graphHiddenLinkIds(scope: GraphScope): LinkId[] {
    const bucket = roots.get(scope.rootGraphId)
    const ownerIds = bucket?.idsByOwner.get(scope.owningGraphId)
    if (!bucket || !ownerIds) return EMPTY_IDS as LinkId[]
    const hidden: LinkId[] = []
    for (const linkId of ownerIds) {
      if (bucket.byId.get(linkId)?.presentation.hidden) hidden.push(linkId)
    }
    return hidden
  }

  function clearGraph(rootGraphId: RootGraphId): void {
    roots.delete(rootGraphId)
  }

  function clearOwner(
    scope: GraphScope,
    _context?: RemoteMutationContext
  ): void {
    const bucket = roots.get(scope.rootGraphId)
    const ownerIds = bucket?.idsByOwner.get(scope.owningGraphId)
    if (!bucket || !ownerIds) return
    for (const linkId of [...ownerIds]) {
      displace(scope.rootGraphId, bucket, linkId, scope.owningGraphId)
    }
  }

  return {
    patch,
    take,
    getPresentation,
    graphHiddenLinkIds,
    clearGraph,
    clearOwner
  }
})
