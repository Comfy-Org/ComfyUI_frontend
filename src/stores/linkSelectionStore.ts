import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { LLink } from '@/lib/litegraph/src/LLink'
import type { Bounds } from '@/renderer/core/layout/types'

interface LinkSelection {
  readonly links: readonly LLink[]
  readonly marquee: Bounds
  readonly anchorX: number
  readonly includesHidden?: boolean
}

export const useLinkSelectionStore = defineStore('linkSelection', () => {
  const selection = shallowRef<LinkSelection | null>(null)

  function select(next: LinkSelection): void {
    selection.value = next.links.length ? next : null
  }

  function clear(): boolean {
    if (!selection.value) return false
    selection.value = null
    return true
  }

  return { selection, select, clear }
})
