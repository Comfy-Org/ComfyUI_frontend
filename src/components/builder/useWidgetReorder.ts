import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Directive } from 'vue'

import { groupItemKey, inputItemKey } from '@/components/builder/itemKeyHelper'
import { useAppModeStore } from '@/stores/appModeStore'

/** Determine if cursor is in the top or bottom half of the element. */
function getEdge(el: HTMLElement, clientY: number): 'before' | 'after' {
  const rect = el.getBoundingClientRect()
  return clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

/** Three-zone detection: top third = before, center = pair, bottom third = after. */
export function getEdgeTriZone(
  el: HTMLElement,
  clientY: number
): 'before' | 'center' | 'after' {
  const rect = el.getBoundingClientRect()
  const third = rect.height / 3
  if (clientY < rect.top + third) return 'before'
  if (clientY > rect.top + third * 2) return 'after'
  return 'center'
}

function clearIndicator(el: HTMLElement) {
  el.classList.remove('reorder-before', 'reorder-after', 'pair-indicator')
}

function setIndicator(el: HTMLElement, edge: 'before' | 'after' | 'center') {
  clearIndicator(el)
  if (edge === 'center') el.classList.add('pair-indicator')
  else el.classList.add(`reorder-${edge}`)
}

/** Extract item key from drag data. */
function getDragKey(data: Record<string | symbol, unknown>): string | null {
  if (data.type === 'zone-widget')
    return inputItemKey(data.nodeId as string, data.widgetName as string)
  if (data.type === 'zone-output') return `output:${data.nodeId}`
  if (data.type === 'zone-run-controls') return 'run-controls'
  if (data.type === 'zone-preset-strip') return 'preset-strip'
  if (data.type === 'zone-group') return groupItemKey(data.groupId as string)
  return null
}

function getDragZone(data: Record<string | symbol, unknown>): string | null {
  return (data.sourceZone as string) ?? null
}

/** Both keys are input widgets — eligible for center-drop pairing. */
function canPairKeys(a: string, b: string): boolean {
  return a.startsWith('input:') && b.startsWith('input:')
}

// --- Unified reorder drop target ---

interface ZoneItemReorderBinding {
  /** The item key for this drop target (e.g. "input:5:steps", "output:7", "run-controls"). */
  itemKey: string
  /** The zone this item belongs to. */
  zone: string
}

type ReorderEl = HTMLElement & {
  __reorderCleanup?: () => void
  __reorderValue?: ZoneItemReorderBinding
}

/**
 * Unified reorder directive — any zone item (input, output, run controls)
 * can be reordered relative to any other item in the same zone.
 * When two input widgets are involved, center-drop creates a paired group.
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
        // Same zone or from a group, different item
        return (
          (dragZone === typedEl.__reorderValue!.zone ||
            dragZone === '__group__') &&
          dragKey !== typedEl.__reorderValue!.itemKey
        )
      },
      onDrag: ({ location, source }) => {
        const dragKey = getDragKey(source.data)
        const targetKey = typedEl.__reorderValue!.itemKey
        const pairingAllowed = dragKey && canPairKeys(dragKey, targetKey)
        const edge = pairingAllowed
          ? getEdgeTriZone(el, location.current.input.clientY)
          : getEdge(el, location.current.input.clientY)
        setIndicator(el, edge)
      },
      onDragEnter: ({ location, source }) => {
        const dragKey = getDragKey(source.data)
        const targetKey = typedEl.__reorderValue!.itemKey
        const pairingAllowed = dragKey && canPairKeys(dragKey, targetKey)
        const edge = pairingAllowed
          ? getEdgeTriZone(el, location.current.input.clientY)
          : getEdge(el, location.current.input.clientY)
        setIndicator(el, edge)
      },
      onDragLeave: () => clearIndicator(el),
      onDrop: ({ source, location, self }) => {
        clearIndicator(el)
        // Skip if a nested drop target (e.g. group body) is the innermost target
        const innermost = location.current.dropTargets[0]
        if (innermost && innermost.element !== self.element) return

        const dragKey = getDragKey(source.data)
        if (!dragKey) return

        const { zone, itemKey } = typedEl.__reorderValue!
        const pairingAllowed = canPairKeys(dragKey, itemKey)
        const edge = pairingAllowed
          ? getEdgeTriZone(el, location.current.input.clientY)
          : getEdge(el, location.current.input.clientY)

        if (edge === 'center') {
          appModeStore.moveWidgetItem(dragKey, {
            kind: 'zone-pair',
            zoneId: zone,
            targetKey: itemKey
          })
        } else {
          appModeStore.moveWidgetItem(dragKey, {
            kind: 'zone-relative',
            zoneId: zone,
            targetKey: itemKey,
            edge
          })
        }
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
