import { useStorage } from '@vueuse/core'
import type { Ref } from 'vue'

// localStorage-backed MRU list of model identifiers (asset filenames) the user
// has picked from a node's model widget. Surfaced as a "Recently used" section
// at the top of the model dropdown so users can jump back to recent picks.
//
// Stored as a flat array; most recently used first. Capped to keep storage
// bounded and the popover scannable.

const STORAGE_KEY = 'Comfy.NodeModelWidget.RecentlyUsed.v1'
const MAX_ENTRIES = 16
const TOP_DISPLAY = 3

const recentNames: Ref<string[]> = useStorage<string[]>(STORAGE_KEY, [])

export function useRecentlyUsedModels() {
  function markUsed(name: string): void {
    const trimmed = name?.trim()
    if (!trimmed) return
    const next = [trimmed, ...recentNames.value.filter((n) => n !== trimmed)]
    recentNames.value = next.slice(0, MAX_ENTRIES)
  }

  return {
    recentNames,
    /** Names to render in the "Recently used" section, most recent first. */
    topNames: () => recentNames.value.slice(0, TOP_DISPLAY),
    markUsed
  }
}
