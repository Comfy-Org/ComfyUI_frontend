import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Directive } from 'vue'

import { parseInputItemKey } from '@/components/builder/itemKeyHelper'
import { useInputGroupStore } from '@/stores/inputGroupStore'

/** Divide an element into three vertical zones for drop detection. */
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

export function getDragItemKey(
  data: Record<string | symbol, unknown>
): string | null {
  if (data.type === 'group-item' && typeof data.itemKey === 'string')
    return data.itemKey
  return null
}

function clearIndicator(el: HTMLElement) {
  el.classList.remove('reorder-before', 'reorder-after', 'pair-indicator')
}

function setIndicator(el: HTMLElement, edge: 'before' | 'center' | 'after') {
  clearIndicator(el)
  if (edge === 'center') el.classList.add('pair-indicator')
  else el.classList.add(`reorder-${edge}`)
}

// ── Item reorder + pair drop target ──────────────────────────────────

interface ItemReorderBinding {
  itemKey: string
  groupId: string
}

type ItemReorderEl = HTMLElement & {
  __reorderCleanup?: () => void
  __reorderValue?: ItemReorderBinding
}

export const vGroupItemReorder: Directive<HTMLElement, ItemReorderBinding> = {
  mounted(el, { value }) {
    const typedEl = el as ItemReorderEl
    typedEl.__reorderValue = value
    const store = useInputGroupStore()

    typedEl.__reorderCleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const dragKey = getDragItemKey(source.data)
        return !!dragKey && dragKey !== typedEl.__reorderValue!.itemKey
      },
      onDrag: ({ location }) => {
        setIndicator(el, getEdgeTriZone(el, location.current.input.clientY))
      },
      onDragEnter: ({ location }) => {
        setIndicator(el, getEdgeTriZone(el, location.current.input.clientY))
      },
      onDragLeave: () => clearIndicator(el),
      onDrop: ({ source, location }) => {
        clearIndicator(el)
        const dragKey = getDragItemKey(source.data)
        if (!dragKey) return

        const { groupId, itemKey } = typedEl.__reorderValue!
        const edge = getEdgeTriZone(el, location.current.input.clientY)
        const sameGroup = !!store
          .findGroup(groupId)
          ?.items.some((i) => i.key === dragKey)

        if (!sameGroup) {
          store.moveItemToGroupAt(groupId, dragKey, itemKey, edge)
          return
        }

        if (edge === 'center') {
          const targetItem = store
            .findGroup(groupId)
            ?.items.find((i) => i.key === itemKey)
          if (targetItem?.pairId) {
            store.replaceInPair(groupId, itemKey, dragKey)
          } else {
            store.pairItemsInGroup(groupId, itemKey, dragKey)
          }
        } else {
          store.unpairItem(groupId, dragKey)
          store.reorderWithinGroup(groupId, dragKey, itemKey, edge)
        }
      }
    })
  },
  updated(el, { value }) {
    ;(el as ItemReorderEl).__reorderValue = value
  },
  unmounted(el) {
    ;(el as ItemReorderEl).__reorderCleanup?.()
  }
}

// ── Draggable item ───────────────────────────────────────────────────

interface ItemDragBinding {
  itemKey: string
  groupId: string
}

type ItemDragEl = HTMLElement & {
  __dragCleanup?: () => void
  __dragValue?: ItemDragBinding
}

export const vGroupItemDrag: Directive<HTMLElement, ItemDragBinding> = {
  mounted(el, { value }) {
    const typedEl = el as ItemDragEl
    typedEl.__dragValue = value
    const store = useInputGroupStore()

    typedEl.__dragCleanup = draggable({
      element: el,
      getInitialData: () => {
        const parsed = parseInputItemKey(typedEl.__dragValue!.itemKey)
        return {
          type: 'group-item',
          itemKey: typedEl.__dragValue!.itemKey,
          nodeId: parsed?.nodeId ?? '',
          widgetName: parsed?.widgetName ?? '',
          sourceGroupId: typedEl.__dragValue!.groupId
        }
      },
      onDrop: ({ location }) => {
        if (location.current.dropTargets.length > 0) return
        const { groupId, itemKey } = typedEl.__dragValue!
        // Still over own group body → don't ungroup
        const overGroup = findGroupDropUnderPointer(
          location.current.input.clientX,
          location.current.input.clientY
        )
        if (overGroup?.groupId === groupId) return
        store.removeItemFromGroup(groupId, itemKey)
      }
    })
  },
  updated(el, { value }) {
    ;(el as ItemDragEl).__dragValue = value
  },
  unmounted(el) {
    ;(el as ItemDragEl).__dragCleanup?.()
  }
}

// ── Group body drop target (for items dragged from outside) ──────────

interface GroupDropBinding {
  groupId: string
}

type GroupDropEl = HTMLElement & {
  __groupDropCleanup?: () => void
  __groupDropValue?: GroupDropBinding
}

const GROUP_DROP_ATTR = 'data-group-drop-id'

/** Find the group drop target under the pointer, ignoring the dragged element. */
function findGroupDropUnderPointer(
  x: number,
  y: number
): { el: HTMLElement; groupId: string } | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const groupId = (el as HTMLElement).getAttribute?.(GROUP_DROP_ATTR)
    if (groupId) return { el: el as HTMLElement, groupId }
  }
  return null
}

/**
 * Document-level mouseup bridge: when a DraggableList drag ends over a group
 * drop target, add the item to that group. Captures the item key on mousedown
 * to avoid racing with DraggableList's cleanup (which removes .is-draggable).
 */
let pendingDragKey: string | null = null
let bridgeRefCount = 0
let removeBridge: (() => void) | null = null

function setupListToGroupBridge() {
  function onMouseDown(e: MouseEvent) {
    const target = (e.target as HTMLElement)?.closest?.('.draggable-item')
    pendingDragKey = (target as HTMLElement)?.dataset?.itemKey ?? null
  }
  function onMouseUp(e: MouseEvent) {
    const itemKey = pendingDragKey
    pendingDragKey = null
    if (!itemKey) return

    const target = findGroupDropUnderPointer(e.clientX, e.clientY)
    if (!target) return

    const store = useInputGroupStore()
    const group = store.findGroup(target.groupId)
    if (group?.items.some((i) => i.key === itemKey)) return

    store.addItemToGroup(target.groupId, itemKey)
  }
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mouseup', onMouseUp)
  removeBridge = () => {
    document.removeEventListener('mousedown', onMouseDown)
    document.removeEventListener('mouseup', onMouseUp)
  }
}

export const vGroupDropTarget: Directive<HTMLElement, GroupDropBinding> = {
  mounted(el, { value }) {
    const typedEl = el as GroupDropEl
    typedEl.__groupDropValue = value
    const store = useInputGroupStore()

    el.setAttribute(GROUP_DROP_ATTR, value.groupId)

    bridgeRefCount++
    if (bridgeRefCount === 1) setupListToGroupBridge()

    // Pragmatic DnD drop target (for items dragged within/between groups)
    typedEl.__groupDropCleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const itemKey = getDragItemKey(source.data)
        if (!itemKey) return false
        const group = store.findGroup(typedEl.__groupDropValue!.groupId)
        return !group?.items.some((i) => i.key === itemKey)
      },
      onDragEnter: () => el.classList.add('group-drag-over'),
      onDragLeave: () => el.classList.remove('group-drag-over'),
      onDrop: ({ source, location }) => {
        el.classList.remove('group-drag-over')
        if (location.current.dropTargets[0]?.element !== el) return
        const itemKey = getDragItemKey(source.data)
        if (!itemKey) return
        store.addItemToGroup(typedEl.__groupDropValue!.groupId, itemKey)
      }
    })
  },
  updated(el, { value }) {
    ;(el as GroupDropEl).__groupDropValue = value
    el.setAttribute(GROUP_DROP_ATTR, value.groupId)
  },
  unmounted(el) {
    ;(el as GroupDropEl).__groupDropCleanup?.()
    el.removeAttribute(GROUP_DROP_ATTR)
    bridgeRefCount--
    if (bridgeRefCount === 0) {
      removeBridge?.()
      removeBridge = null
    }
  }
}
