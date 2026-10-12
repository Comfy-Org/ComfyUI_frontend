import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { GraphScope } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

interface LinkSelection {
  readonly scope: GraphScope
  readonly linkIds: readonly LinkId[]
}

const NO_LINKS: readonly LinkId[] = []

function isSameScope(a: GraphScope, b: GraphScope): boolean {
  return a.rootGraphId === b.rootGraphId && a.owningGraphId === b.owningGraphId
}

/** Links picked by a marquee that captured no other canvas items. */
export const useLinkSelectionStore = defineStore('linkSelection', () => {
  const selection = shallowRef<LinkSelection | null>(null)

  function select(scope: GraphScope, linkIds: Iterable<LinkId>): void {
    const ids = [...linkIds]
    selection.value = ids.length ? { scope, linkIds: ids } : null
  }

  function clear(): void {
    if (selection.value) selection.value = null
  }

  function linkIdsIn(scope: GraphScope): readonly LinkId[] {
    const current = selection.value
    return current && isSameScope(current.scope, scope)
      ? current.linkIds
      : NO_LINKS
  }

  return { selection, select, clear, linkIdsIn }
})
