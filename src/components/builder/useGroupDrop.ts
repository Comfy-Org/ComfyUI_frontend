import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Directive } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useInputGroupStore } from '@/stores/inputGroupStore'
import { isWidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

type ItemDragBinding = { itemKey: WidgetId; sourceGroupId?: string }
type GroupItemBinding = { itemKey: WidgetId; groupId: string }
type UngroupedItemBinding = { itemKey: WidgetId }
type GroupDropBinding = { groupId: string }
type Zone = 'before' | 'center' | 'after'

type DragData = Record<string | symbol, unknown>
interface BindingState<T> {
  value: T
  cleanup?: () => void
}

const dragStates = new WeakMap<HTMLElement, BindingState<ItemDragBinding>>()
const groupItemStates = new WeakMap<
  HTMLElement,
  BindingState<GroupItemBinding>
>()
const ungroupedItemStates = new WeakMap<
  HTMLElement,
  BindingState<UngroupedItemBinding>
>()
const groupDropStates = new WeakMap<
  HTMLElement,
  BindingState<GroupDropBinding>
>()
const ungroupDropStates = new WeakMap<HTMLElement, BindingState<boolean>>()

export function getDragItemKey(data: DragData): WidgetId | null {
  return data.type === 'group-item' && isWidgetId(data.itemKey)
    ? data.itemKey
    : null
}

export function isCurrentWorkflowDrag(
  data: DragData,
  activeWorkflow: unknown
): boolean {
  return activeWorkflow != null && data.workflow === activeWorkflow
}

function activeDragKey(data: DragData): WidgetId | null {
  if (!isCurrentWorkflowDrag(data, useWorkflowStore().activeWorkflow))
    return null
  return getDragItemKey(data)
}

export function getEdgeTriZone(element: HTMLElement, clientY: number): Zone {
  const rect = element.getBoundingClientRect()
  const third = rect.height / 3
  if (clientY < rect.top + third) return 'before'
  if (clientY > rect.top + third * 2) return 'after'
  return 'center'
}

export function getUngroupedEdge(
  element: HTMLElement,
  clientY: number
): 'before' | 'after' {
  const rect = element.getBoundingClientRect()
  return clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

function clearIndicator(element: HTMLElement) {
  element.classList.remove('reorder-before', 'reorder-after', 'pair-indicator')
}

function setIndicator(element: HTMLElement, zone: Zone) {
  clearIndicator(element)
  element.classList.add(
    zone === 'center' ? 'pair-indicator' : `reorder-${zone}`
  )
}

function registerDrag(element: HTMLElement, value: ItemDragBinding) {
  const state: BindingState<ItemDragBinding> = { value }
  state.cleanup = draggable({
    element,
    dragHandle: element.querySelector<HTMLElement>('.drag-handle') ?? undefined,
    getInitialData: () => ({
      type: 'group-item',
      itemKey: state.value.itemKey,
      sourceGroupId: state.value.sourceGroupId,
      workflow: useWorkflowStore().activeWorkflow
    })
  })
  dragStates.set(element, state)
}

/** One Pragmatic DnD source for both grouped and ungrouped inputs. */
export const vGroupItemDrag: Directive<
  HTMLElement,
  ItemDragBinding | undefined
> = {
  mounted(element, { value }) {
    if (value) registerDrag(element, value)
  },
  updated(element, { value }) {
    const state = dragStates.get(element)
    if (!value) {
      state?.cleanup?.()
      dragStates.delete(element)
    } else if (state) {
      state.value = value
    } else {
      registerDrag(element, value)
    }
  },
  unmounted(element) {
    dragStates.get(element)?.cleanup?.()
    dragStates.delete(element)
  }
}

/** Drop onto an existing grouped widget: reorder or pair. */
export const vGroupItemReorder: Directive<HTMLElement, GroupItemBinding> = {
  mounted(element, { value }) {
    const state: BindingState<GroupItemBinding> = { value }
    const store = useInputGroupStore()

    state.cleanup = dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const key = activeDragKey(source.data)
        return (
          key !== null &&
          key !== state.value.itemKey &&
          !!store.findGroup(state.value.groupId)
        )
      },
      onDrag: ({ location }) =>
        setIndicator(
          element,
          getEdgeTriZone(element, location.current.input.clientY)
        ),
      onDragEnter: ({ location }) =>
        setIndicator(
          element,
          getEdgeTriZone(element, location.current.input.clientY)
        ),
      onDragLeave: () => clearIndicator(element),
      onDrop: ({ source, location }) => {
        clearIndicator(element)
        if (location.current.dropTargets[0]?.element !== element) return
        const key = activeDragKey(source.data)
        if (!key) return

        const { groupId, itemKey } = state.value
        const group = store.findGroup(groupId)
        if (!group) return
        const zone = getEdgeTriZone(element, location.current.input.clientY)
        const inGroup = group.items.some((item) => item.key === key)
        if (!inGroup) {
          store.moveItemToGroupAt(groupId, key, itemKey, zone)
        } else if (zone === 'center') {
          const target = group.items.find((item) => item.key === itemKey)
          if (target?.pairId) store.replaceInPair(groupId, itemKey, key)
          else store.pairItemsInGroup(groupId, itemKey, key)
        } else {
          store.reorderWithinGroup(groupId, key, itemKey, zone)
        }
      }
    })
    groupItemStates.set(element, state)
  },
  updated(element, { value }) {
    const state = groupItemStates.get(element)
    if (state) state.value = value
  },
  unmounted(element) {
    groupItemStates.get(element)?.cleanup?.()
    groupItemStates.delete(element)
    clearIndicator(element)
  }
}

function registerUngroupedTarget(
  element: HTMLElement,
  value: UngroupedItemBinding
) {
  const state: BindingState<UngroupedItemBinding> = { value }
  const store = useInputGroupStore()
  state.cleanup = dropTargetForElements({
    element,
    canDrop: ({ source }) => {
      return activeDragKey(source.data) !== null
    },
    onDrag: ({ source, location }) => {
      if (activeDragKey(source.data) === state.value.itemKey) {
        clearIndicator(element)
        return
      }
      setIndicator(
        element,
        getUngroupedEdge(element, location.current.input.clientY)
      )
    },
    onDragEnter: ({ source, location }) => {
      if (activeDragKey(source.data) === state.value.itemKey) return
      setIndicator(
        element,
        getUngroupedEdge(element, location.current.input.clientY)
      )
    },
    onDragLeave: () => clearIndicator(element),
    onDrop: ({ source, location }) => {
      clearIndicator(element)
      if (location.current.dropTargets[0]?.element !== element) return
      const key = activeDragKey(source.data)
      if (!key) return
      store.moveToUngrouped(
        key,
        state.value.itemKey,
        getUngroupedEdge(element, location.current.input.clientY)
      )
    }
  })
  ungroupedItemStates.set(element, state)
}

export const vUngroupedItemReorder: Directive<
  HTMLElement,
  UngroupedItemBinding | undefined
> = {
  mounted(element, { value }) {
    if (value) registerUngroupedTarget(element, value)
  },
  updated(element, { value }) {
    const state = ungroupedItemStates.get(element)
    if (!value) {
      state?.cleanup?.()
      ungroupedItemStates.delete(element)
      clearIndicator(element)
    } else if (state) {
      state.value = value
    } else {
      registerUngroupedTarget(element, value)
    }
  },
  unmounted(element) {
    ungroupedItemStates.get(element)?.cleanup?.()
    ungroupedItemStates.delete(element)
    clearIndicator(element)
  }
}

/** Drop onto an empty/blank group body. Inner item targets take precedence. */
export const vGroupDropTarget: Directive<HTMLElement, GroupDropBinding> = {
  mounted(element, { value }) {
    const state: BindingState<GroupDropBinding> = { value }
    const store = useInputGroupStore()
    state.cleanup = dropTargetForElements({
      element,
      canDrop: ({ source }) =>
        activeDragKey(source.data) !== null &&
        !!store.findGroup(state.value.groupId),
      onDragEnter: () => element.classList.add('group-drag-over'),
      onDragLeave: () => element.classList.remove('group-drag-over'),
      onDrop: ({ source, location }) => {
        element.classList.remove('group-drag-over')
        if (location.current.dropTargets[0]?.element !== element) return
        const key = activeDragKey(source.data)
        if (key) store.addItemToGroup(state.value.groupId, key)
      }
    })
    groupDropStates.set(element, state)
  },
  updated(element, { value }) {
    const state = groupDropStates.get(element)
    if (state) state.value = value
  },
  unmounted(element) {
    groupDropStates.get(element)?.cleanup?.()
    groupDropStates.delete(element)
    element.classList.remove('group-drag-over')
  }
}

/** Drop onto unused space in the main list: ungroup or move to its end. */
export const vGroupUngroupTarget: Directive<HTMLElement, boolean> = {
  mounted(element, { value }) {
    const state: BindingState<boolean> = { value }
    const store = useInputGroupStore()
    state.cleanup = dropTargetForElements({
      element,
      canDrop: ({ source }) =>
        state.value && activeDragKey(source.data) !== null,
      onDrop: ({ source, location }) => {
        if (location.current.dropTargets[0]?.element !== element) return
        const key = activeDragKey(source.data)
        if (key) store.moveToUngrouped(key)
      }
    })
    ungroupDropStates.set(element, state)
  },
  updated(element, { value }) {
    const state = ungroupDropStates.get(element)
    if (state) state.value = value
  },
  unmounted(element) {
    ungroupDropStates.get(element)?.cleanup?.()
    ungroupDropStates.delete(element)
  }
}
