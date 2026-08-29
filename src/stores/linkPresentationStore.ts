import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
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

/** Builds the canonical compact record: `hidden` only when true, `label` only when defined. */
export function compactLinkPresentation(
  hidden: boolean | undefined,
  label: string | undefined
): LinkPresentation {
  return {
    ...(hidden && { hidden: true }),
    ...(label !== undefined && { label })
  }
}

interface OwnedLinkPresentation extends LinkPresentation {
  graphId: OwningGraphId
}

/**
 * Link presentation store, partitioned by root graph and keyed by link id —
 * the durable sidecar of the link topology store for non-topology link state
 * (`extra.linkPresentation` in the wire format). Entries exist only for links
 * with non-default presentation: a patch that empties an entry deletes it, so
 * the store's contents are exactly the serialization set.
 */
export const useLinkPresentationStore = defineStore('linkPresentation', () => {
  const roots = reactive(
    new Map<RootGraphId, Map<LinkId, OwnedLinkPresentation>>()
  )

  function createRootBucket(
    rootGraphId: RootGraphId
  ): Map<LinkId, OwnedLinkPresentation> {
    const created = reactive(new Map<LinkId, OwnedLinkPresentation>())
    roots.set(rootGraphId, created)
    return created
  }

  /**
   * Merges a {@link LinkPresentationPatch} into a link's entry; an entry with
   * no remaining fields is deleted. The first-writing graph owns the entry: a
   * different owner cannot overwrite it.
   */
  function patch(
    scope: GraphScope,
    linkId: LinkId,
    partial: LinkPresentationPatch
  ): void {
    const bucket = roots.get(scope.rootGraphId)
    const incumbent = bucket?.get(linkId)
    if (incumbent && incumbent.graphId !== scope.owningGraphId) {
      console.error(
        `[linkPresentationStore] Link ${linkId} presentation belongs to graph ${incumbent.graphId}; graph ${scope.owningGraphId} cannot overwrite it.`
      )
      return
    }
    const hidden = 'hidden' in partial ? partial.hidden : incumbent?.hidden
    const label = 'label' in partial ? partial.label : incumbent?.label
    if (!hidden && label === undefined) {
      if (bucket?.delete(linkId) && bucket.size === 0) {
        roots.delete(scope.rootGraphId)
      }
      return
    }
    const target = bucket ?? createRootBucket(scope.rootGraphId)
    target.set(linkId, {
      graphId: scope.owningGraphId,
      ...compactLinkPresentation(hidden, label)
    })
  }

  /** Removes and returns a link's presentation, for stashing across a transfer. */
  function take(
    scope: GraphScope,
    linkId: LinkId
  ): LinkPresentation | undefined {
    const bucket = roots.get(scope.rootGraphId)
    const entry = bucket?.get(linkId)
    if (!bucket || !entry || entry.graphId !== scope.owningGraphId) return
    bucket.delete(linkId)
    if (bucket.size === 0) roots.delete(scope.rootGraphId)
    return compactLinkPresentation(entry.hidden, entry.label)
  }

  /** Returns the live store record for a link `scope` owns. */
  function getPresentation(
    scope: GraphScope,
    linkId: LinkId
  ): Readonly<LinkPresentation> | undefined {
    const entry = roots.get(scope.rootGraphId)?.get(linkId)
    return entry?.graphId === scope.owningGraphId ? entry : undefined
  }

  /** Ids of a graph's hidden links — the render index; empty cost when nothing is hidden. */
  function graphHiddenLinkIds(scope: GraphScope): LinkId[] {
    const bucket = roots.get(scope.rootGraphId)
    if (!bucket) return []
    const ids: LinkId[] = []
    for (const [linkId, entry] of bucket) {
      if (entry.graphId === scope.owningGraphId && entry.hidden) {
        ids.push(linkId)
      }
    }
    return ids
  }

  function clearGraph(rootGraphId: RootGraphId): void {
    roots.delete(rootGraphId)
  }

  function clearOwner(scope: GraphScope): void {
    const bucket = roots.get(scope.rootGraphId)
    if (!bucket) return
    for (const [linkId, entry] of [...bucket]) {
      if (entry.graphId === scope.owningGraphId) bucket.delete(linkId)
    }
    if (bucket.size === 0) roots.delete(scope.rootGraphId)
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
