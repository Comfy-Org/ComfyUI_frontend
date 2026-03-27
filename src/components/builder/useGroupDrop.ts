import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Directive } from 'vue'

import {
  inputItemKey,
  parseInputItemKey
} from '@/components/builder/itemKeyHelper'
import { getEdgeTriZone } from '@/components/builder/useWidgetReorder'
import { useAppModeStore } from '@/stores/appModeStore'

function getDragItemKey(data: Record<string | symbol, unknown>): string | null {
  if (data.type === 'zone-widget')
    return inputItemKey(data.nodeId as string, data.widgetName as string)
  return null
}

// --- Group body drop target ---

interface GroupDropBinding {
  groupId: string
  zoneId: string
}

type GroupDropEl = HTMLElement & {
  __groupDropCleanup?: () => void
  __groupDropValue?: GroupDropBinding
}

/** Drop zone for the group body — accepts zone-widget drags. */
export const vGroupDropTarget: Directive<HTMLElement, GroupDropBinding> = {
  mounted(el, { value }) {
    const typedEl = el as GroupDropEl
    typedEl.__groupDropValue = value
    const appModeStore = useAppModeStore()

    typedEl.__groupDropCleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const itemKey = getDragItemKey(source.data)
        if (!itemKey) return false
        const group = appModeStore.inputGroups.find(
          (g) => g.id === typedEl.__groupDropValue!.groupId
        )
        return !group?.items.some((i) => i.key === itemKey)
      },
      onDragEnter: () => el.classList.add('group-drag-over'),
      onDragLeave: () => el.classList.remove('group-drag-over'),
      onDrop: ({ source, location }) => {
        el.classList.remove('group-drag-over')
        // Skip if the innermost drop target is a child (item reorder handled it)
        if (location.current.dropTargets[0]?.element !== el) return
        const itemKey = getDragItemKey(source.data)
        if (!itemKey) return
        const { groupId, zoneId } = typedEl.__groupDropValue!
        appModeStore.moveWidgetItem(itemKey, {
          kind: 'group',
          zoneId,
          groupId
        })
      }
    })
  },
  updated(el, { value }) {
    ;(el as GroupDropEl).__groupDropValue = value
  },
  unmounted(el) {
    ;(el as GroupDropEl).__groupDropCleanup?.()
  }
}

// --- Group item reorder (with center detection for pairing) ---

interface GroupItemReorderBinding {
  itemKey: string
  groupId: string
}

type GroupItemReorderEl = HTMLElement & {
  __groupReorderCleanup?: () => void
  __groupReorderValue?: GroupItemReorderBinding
}

function clearGroupIndicator(el: HTMLElement) {
  el.classList.remove('reorder-before', 'reorder-after', 'pair-indicator')
}

function setGroupIndicator(
  el: HTMLElement,
  edge: 'before' | 'center' | 'after'
) {
  clearGroupIndicator(el)
  if (edge === 'center') {
    el.classList.add('pair-indicator')
  } else {
    el.classList.add(`reorder-${edge}`)
  }
}

/** Reorder within a group with three-zone detection for side-by-side pairing. */
export const vGroupItemReorderTarget: Directive<
  HTMLElement,
  GroupItemReorderBinding
> = {
  mounted(el, { value }) {
    const typedEl = el as GroupItemReorderEl
    typedEl.__groupReorderValue = value
    const appModeStore = useAppModeStore()

    typedEl.__groupReorderCleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const dragKey = getDragItemKey(source.data)
        return !!dragKey && dragKey !== typedEl.__groupReorderValue!.itemKey
      },
      onDrag: ({ location }) => {
        setGroupIndicator(
          el,
          getEdgeTriZone(el, location.current.input.clientY)
        )
      },
      onDragEnter: ({ location }) => {
        setGroupIndicator(
          el,
          getEdgeTriZone(el, location.current.input.clientY)
        )
      },
      onDragLeave: () => clearGroupIndicator(el),
      onDrop: ({ source, location }) => {
        clearGroupIndicator(el)
        const dragKey = getDragItemKey(source.data)
        if (!dragKey) return

        const { groupId, itemKey } = typedEl.__groupReorderValue!
        const edge = getEdgeTriZone(el, location.current.input.clientY)

        appModeStore.moveWidgetItem(dragKey, {
          kind: 'group-relative',
          zoneId: '',
          groupId,
          targetKey: itemKey,
          edge
        })
      }
    })
  },
  updated(el, { value }) {
    ;(el as GroupItemReorderEl).__groupReorderValue = value
  },
  unmounted(el) {
    ;(el as GroupItemReorderEl).__groupReorderCleanup?.()
  }
}

// --- Draggable for items inside a group ---

interface GroupItemDragBinding {
  itemKey: string
  groupId: string
}

type GroupItemDragEl = HTMLElement & {
  __groupItemDragCleanup?: () => void
  __groupItemDragValue?: GroupItemDragBinding
}

/** Makes an item inside a group draggable. */
export const vGroupItemDraggable: Directive<HTMLElement, GroupItemDragBinding> =
  {
    mounted(el, { value }) {
      const typedEl = el as GroupItemDragEl
      typedEl.__groupItemDragValue = value

      typedEl.__groupItemDragCleanup = draggable({
        element: el,
        getInitialData: () => {
          const parsed = parseInputItemKey(
            typedEl.__groupItemDragValue!.itemKey
          )
          return {
            type: 'zone-widget',
            nodeId: parsed?.nodeId ?? '',
            widgetName: parsed?.widgetName ?? '',
            sourceZone: '__group__',
            sourceGroupId: typedEl.__groupItemDragValue!.groupId
          }
        }
      })
    },
    updated(el, { value }) {
      ;(el as GroupItemDragEl).__groupItemDragValue = value
    },
    unmounted(el) {
      ;(el as GroupItemDragEl).__groupItemDragCleanup?.()
    }
  }

// --- Draggable for entire group (reorder within zone) ---

interface GroupDragBinding {
  groupId: string
  zone: string
}

type GroupDragEl = HTMLElement & {
  __groupDragCleanup?: () => void
  __groupDragValue?: GroupDragBinding
}

/** Makes a group draggable within the zone order. Uses drag-handle class. */
export const vGroupDraggable: Directive<HTMLElement, GroupDragBinding> = {
  mounted(el, { value }) {
    const typedEl = el as GroupDragEl
    typedEl.__groupDragValue = value

    typedEl.__groupDragCleanup = draggable({
      element: el,
      dragHandle: el.querySelector('.drag-handle') ?? undefined,
      getInitialData: () => ({
        type: 'zone-group',
        groupId: typedEl.__groupDragValue!.groupId,
        sourceZone: typedEl.__groupDragValue!.zone
      })
    })
  },
  updated(el, { value }) {
    ;(el as GroupDragEl).__groupDragValue = value
  },
  unmounted(el) {
    ;(el as GroupDragEl).__groupDragCleanup?.()
  }
}
