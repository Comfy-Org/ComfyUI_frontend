import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { LLink } from '@/lib/litegraph/src/LLink'
import type { Bounds } from '@comfyorg/shared-frontend-utils/geometry'
import type { SlotDirection } from '@comfyorg/graph-model/slotId'

interface LinkSelection {
  readonly links: readonly LLink[]
  readonly marquee: Bounds
  readonly anchorX: number
  readonly socketType?: SlotDirection
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
