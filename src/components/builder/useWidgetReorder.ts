import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Directive } from 'vue'

import { useAppModeStore } from '@/stores/appModeStore'

/** Determine if cursor is in the top or bottom half of the element. */
function getEdge(el: HTMLElement, clientY: number): 'before' | 'after' {
  const rect = el.getBoundingClientRect()
  return clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

function clearIndicator(el: HTMLElement) {
  el.classList.remove('reorder-before', 'reorder-after')
}

function setIndicator(el: HTMLElement, edge: 'before' | 'after') {
  clearIndicator(el)
  el.classList.add(`reorder-${edge}`)
}

/** Extract item key from drag data. */
function getDragKey(data: Record<string | symbol, unknown>): string | null {
  if (data.type === 'zone-widget')
    return `input:${data.nodeId}:${data.widgetName}`
  if (data.type === 'zone-output') return `output:${data.nodeId}`
  if (data.type === 'zone-run-controls') return 'run-controls'
  if (data.type === 'zone-preset-strip') return 'preset-strip'
  return null
}

function getDragZone(data: Record<string | symbol, unknown>): string | null {
  return (data.sourceZone as string) ?? null
}

// --- Unified reorder drop target ---

interface ZoneItemReorderBinding {
  /** The item key for this drop target (e.g. "input:5:steps", "output:7", "run-controls"). */
  itemKey: string
  /** The zone this item belongs to. */
  zone: string
  /** The current ordered list of item keys for this zone. */
  order: string[]
}

type ReorderEl = HTMLElement & {
  __reorderCleanup?: () => void
  __reorderValue?: ZoneItemReorderBinding
}

/**
 * Unified reorder directive — any zone item (input, output, run controls)
 * can be reordered relative to any other item in the same zone.
 */
export const vZoneItemReorderTarget: Directive<
  HTMLElement,
  ZoneItemReorderBinding
> = {
  mounted(el, { value }) {
    const typedEl = el as ReorderEl
    typedEl.__reorderValue = value
    const appModeStore = useAppModeStore()

    typedEl.__reorderCleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const dragKey = getDragKey(source.data)
        const dragZone = getDragZone(source.data)
        if (!dragKey || !dragZone) return false
        // Same zone, different item
        return (
          dragZone === typedEl.__reorderValue!.zone &&
          dragKey !== typedEl.__reorderValue!.itemKey
        )
      },
      onDrag: ({ location }) => {
        setIndicator(el, getEdge(el, location.current.input.clientY))
      },
      onDragEnter: ({ location }) => {
        setIndicator(el, getEdge(el, location.current.input.clientY))
      },
      onDragLeave: () => clearIndicator(el),
      onDrop: ({ source, location }) => {
        clearIndicator(el)
        const dragKey = getDragKey(source.data)
        if (!dragKey) return
        const edge = getEdge(el, location.current.input.clientY)
        appModeStore.reorderZoneItem(
          typedEl.__reorderValue!.zone,
          dragKey,
          typedEl.__reorderValue!.itemKey,
          edge,
          typedEl.__reorderValue!.order
        )
      }
    })
  },
  updated(el, { value }) {
    ;(el as ReorderEl).__reorderValue = value
  },
  unmounted(el) {
    ;(el as ReorderEl).__reorderCleanup?.()
  }
}
