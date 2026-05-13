import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { Pack } from '../data/cloudNodes'

export type PackSortMode = 'downloads' | 'mostNodes' | 'az' | 'recentlyUpdated'

interface UseFilteredPacksInput {
  packs: MaybeRefOrGetter<readonly Pack[]>
  query: MaybeRefOrGetter<string>
  sortMode: MaybeRefOrGetter<PackSortMode>
}

function matchesQuery(pack: Pack, normalizedQuery: string): boolean {
  if (pack.displayName.toLowerCase().includes(normalizedQuery)) return true
  return pack.nodes.some((node) =>
    node.displayName.toLowerCase().includes(normalizedQuery)
  )
}

function safeTimestamp(value: string | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

export function useFilteredPacks(input: UseFilteredPacksInput) {
  const filteredPacks = computed<Pack[]>(() => {
    const allPacks = toValue(input.packs)
    const normalizedQuery = toValue(input.query).trim().toLowerCase()

    const matching =
      normalizedQuery.length === 0
        ? [...allPacks]
        : allPacks.filter((pack) => matchesQuery(pack, normalizedQuery))

    const mode = toValue(input.sortMode)
    if (mode === 'az') {
      return matching.sort((a, b) => a.displayName.localeCompare(b.displayName))
    }
    if (mode === 'recentlyUpdated') {
      return matching.sort(
        (a, b) => safeTimestamp(b.lastUpdated) - safeTimestamp(a.lastUpdated)
      )
    }
    if (mode === 'mostNodes') {
      return matching.sort((a, b) => b.nodes.length - a.nodes.length)
    }
    return matching.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0))
  })

  return { filteredPacks }
}
