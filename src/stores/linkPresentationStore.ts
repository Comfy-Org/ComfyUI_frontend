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

  /** First writer owns the entry; a different owner cannot overwrite it. */
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
    const hidden =
      'hidden' in partial ? partial.hidden : incumbent?.presentation.hidden
    const label =
      'label' in partial ? partial.label : incumbent?.presentation.label
    const compacted = compactLinkPresentation(hidden, label)
    if (!compacted) {
      if (bucket?.delete(linkId) && bucket.size === 0) {
        roots.delete(scope.rootGraphId)
      }
      return
    }
    const target = bucket ?? createRootBucket(scope.rootGraphId)
    target.set(linkId, {
      graphId: scope.owningGraphId,
      presentation: compacted
    })
  }

  /** For stashing presentation across a transfer. */
  function take(
    scope: GraphScope,
    linkId: LinkId
  ): LinkPresentation | undefined {
    const bucket = roots.get(scope.rootGraphId)
    const entry = bucket?.get(linkId)
    if (!bucket || !entry || entry.graphId !== scope.owningGraphId) return
    bucket.delete(linkId)
    if (bucket.size === 0) roots.delete(scope.rootGraphId)
    return entry.presentation
  }

  function getPresentation(
    scope: GraphScope,
    linkId: LinkId
  ): Readonly<LinkPresentation> | undefined {
    const entry = roots.get(scope.rootGraphId)?.get(linkId)
    return entry?.graphId === scope.owningGraphId
      ? entry.presentation
      : undefined
  }

  function graphHiddenLinkIds(scope: GraphScope): LinkId[] {
    const bucket = roots.get(scope.rootGraphId)
    if (!bucket) return []
    return [...bucket]
      .filter(
        ([, entry]) =>
          entry.graphId === scope.owningGraphId && entry.presentation.hidden
      )
      .map(([linkId]) => linkId)
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
