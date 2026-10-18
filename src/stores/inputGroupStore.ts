import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import type {
  InputGroup,
  LinearData
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useApp } from '@/scripts/appInstance'
import { ChangeTracker } from '@/scripts/changeTracker'
import { isWidgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'

export const useInputGroupStore = defineStore('inputGroup', () => {
  const workflowStore = useWorkflowStore()
  const { isBuilderMode, isAppMode } = useAppMode()

  const inputGroups = ref<InputGroup[]>([])

  const groupedItemKeys = computed(() => {
    const keys = new Set<WidgetId>()
    for (const group of inputGroups.value) {
      for (const item of group.items) keys.add(item.key)
    }
    return keys
  })

  function isGrouped(widgetId: WidgetId): boolean {
    return groupedItemKeys.value.has(widgetId)
  }

  function loadGroups(groups: InputGroup[] | undefined) {
    inputGroups.value = groups
      ? groups.map((group) => ({
          ...group,
          items: group.items
            .filter(({ key }) => isWidgetId(key))
            .map((item) => ({ ...item }))
        }))
      : []
  }

  function persistGroups() {
    if (
      (!isBuilderMode.value && !isAppMode.value) ||
      ChangeTracker.isLoadingGraph
    )
      return
    if (!useApp().isGraphReady) return
    const graph = useApp().rootGraph
    const extra = graph.extra
    const linearData = ((extra.linearData as LinearData | undefined) ??= {
      inputs: [],
      outputs: []
    })
    linearData.inputGroups = inputGroups.value.length
      ? inputGroups.value.map((group) => ({
          ...group,
          items: group.items.map((item) => ({ ...item }))
        }))
      : undefined
    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
  }

  function reloadFromGraph() {
    if (!useApp().isGraphReady) return
    const linearData = useApp().rootGraph.extra.linearData as
      | LinearData
      | undefined
    loadGroups(linearData?.inputGroups)
  }

  watch(
    () => workflowStore.activeWorkflow,
    (workflow) => {
      const linearData = workflow?.changeTracker.activeState.extra
        ?.linearData as LinearData | undefined
      loadGroups(linearData?.inputGroups)
    },
    { immediate: true }
  )

  useEventListener(
    () => (useApp().isGraphReady ? useApp().rootGraph.events : undefined),
    'configured',
    reloadFromGraph
  )

  function findGroup(groupId: string): InputGroup | undefined {
    return inputGroups.value.find((g) => g.id === groupId)
  }

  function createGroup(name?: string, itemKey?: WidgetId): string {
    const id = crypto.randomUUID()
    if (itemKey) removeItemFromAllGroups(itemKey)
    inputGroups.value.push({
      id,
      name: name ?? null,
      items: itemKey ? [{ key: itemKey }] : []
    })
    persistGroups()
    return id
  }

  function deleteGroupInternal(groupId: string) {
    const idx = inputGroups.value.findIndex((g) => g.id === groupId)
    if (idx !== -1) inputGroups.value.splice(idx, 1)
  }

  function deleteGroup(groupId: string) {
    deleteGroupInternal(groupId)
    persistGroups()
  }

  function renameGroup(groupId: string, name: string | null) {
    const group = findGroup(groupId)
    if (!group) return
    group.name = name
    persistGroups()
  }

  function addItemToGroup(groupId: string, itemKey: WidgetId) {
    const group = findGroup(groupId)
    if (!group) return
    if (group.items.some((i) => i.key === itemKey)) return

    removeItemFromAllGroups(itemKey)
    group.items.push({ key: itemKey })
    persistGroups()
  }

  function removeItemFromGroup(groupId: string, itemKey: WidgetId) {
    const group = findGroup(groupId)
    if (!group) return
    const idx = group.items.findIndex((i) => i.key === itemKey)
    if (idx === -1) return
    const pairId = group.items[idx].pairId
    if (pairId) clearPair(group, pairId)
    group.items.splice(idx, 1)
    if (group.items.length === 0) deleteGroupInternal(groupId)
    persistGroups()
  }

  function removeItemFromAllGroups(itemKey: WidgetId) {
    const emptied: string[] = []
    for (const group of inputGroups.value) {
      const idx = group.items.findIndex((i) => i.key === itemKey)
      if (idx !== -1) {
        const pairId = group.items[idx].pairId
        if (pairId) clearPair(group, pairId)
        group.items.splice(idx, 1)
        if (group.items.length === 0) emptied.push(group.id)
      }
    }
    for (const id of emptied) deleteGroupInternal(id)
  }

  function reorderWithinGroup(
    groupId: string,
    fromKey: WidgetId,
    toKey: WidgetId,
    position: 'before' | 'after'
  ) {
    const group = findGroup(groupId)
    if (!group) return
    const fromIdx = group.items.findIndex((i) => i.key === fromKey)
    const toIdx = group.items.findIndex((i) => i.key === toKey)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
    const pairId = group.items[fromIdx].pairId
    if (pairId) clearPair(group, pairId)
    const [moved] = group.items.splice(fromIdx, 1)
    const insertIdx =
      position === 'before'
        ? group.items.findIndex((i) => i.key === toKey)
        : group.items.findIndex((i) => i.key === toKey) + 1
    group.items.splice(insertIdx, 0, moved)
    persistGroups()
  }

  function pairItemsInGroup(groupId: string, keyA: WidgetId, keyB: WidgetId) {
    const group = findGroup(groupId)
    if (!group) return
    const itemA = group.items.find((i) => i.key === keyA)
    const itemB = group.items.find((i) => i.key === keyB)
    if (!itemA || !itemB || itemA === itemB) return
    if (itemA.pairId) clearPair(group, itemA.pairId)
    if (itemB.pairId) clearPair(group, itemB.pairId)
    const pairId = crypto.randomUUID()
    for (const item of group.items) {
      if (item.key === keyA || item.key === keyB) item.pairId = pairId
    }
    persistGroups()
  }

  function replaceInPair(
    groupId: string,
    targetKey: WidgetId,
    replacementKey: WidgetId
  ) {
    const group = findGroup(groupId)
    if (!group) return
    const targetItem = group.items.find((i) => i.key === targetKey)
    if (!targetItem?.pairId) return
    const pairId = targetItem.pairId
    const repIdx = group.items.findIndex((i) => i.key === replacementKey)
    if (repIdx === -1) return
    if (group.items[repIdx].pairId === pairId) return
    const [moved] = group.items.splice(repIdx, 1)
    if (moved.pairId) {
      for (const i of group.items) {
        if (i.pairId === moved.pairId) i.pairId = undefined
      }
    }
    const targetIdx = group.items.findIndex((i) => i.key === targetKey)
    moved.pairId = pairId
    group.items.splice(targetIdx, 0, moved)
    targetItem.pairId = undefined
    persistGroups()
  }

  function moveItemToGroupAt(
    groupId: string,
    itemKey: WidgetId,
    targetKey: WidgetId,
    position: 'before' | 'center' | 'after'
  ) {
    const group = findGroup(groupId)
    if (
      !group ||
      itemKey === targetKey ||
      !group.items.some((item) => item.key === targetKey)
    )
      return
    removeItemFromAllGroups(itemKey)
    if (!group.items.some((i) => i.key === itemKey)) {
      group.items.push({ key: itemKey })
    }
    const dragIdx = group.items.findIndex((i) => i.key === itemKey)
    const targetIdx = group.items.findIndex((i) => i.key === targetKey)
    if (dragIdx !== -1 && targetIdx !== -1 && dragIdx !== targetIdx) {
      const [moved] = group.items.splice(dragIdx, 1)
      const newTargetIdx = group.items.findIndex((i) => i.key === targetKey)
      const insertIdx = position === 'after' ? newTargetIdx + 1 : newTargetIdx
      group.items.splice(insertIdx, 0, moved)
    }
    if (position === 'center') {
      const itemA = group.items.find((i) => i.key === itemKey)
      const itemB = group.items.find((i) => i.key === targetKey)
      if (itemA?.pairId) clearPair(group, itemA.pairId)
      if (itemB?.pairId) clearPair(group, itemB.pairId)
      const pairId = crypto.randomUUID()
      if (itemA) itemA.pairId = pairId
      if (itemB) itemB.pairId = pairId
    }
    persistGroups()
  }

  function unpairItem(groupId: string, itemKey: WidgetId) {
    const group = findGroup(groupId)
    if (!group) return
    const item = group.items.find((i) => i.key === itemKey)
    if (!item?.pairId) return
    clearPair(group, item.pairId)
    persistGroups()
  }

  function clearPair(group: InputGroup, pairId: string) {
    for (const item of group.items) {
      if (item.pairId === pairId) item.pairId = undefined
    }
  }

  return {
    inputGroups,
    isGrouped,
    findGroup,
    createGroup,
    deleteGroup,
    renameGroup,
    addItemToGroup,
    removeItemFromGroup,
    reorderWithinGroup,
    moveItemToGroupAt,
    pairItemsInGroup,
    replaceInPair,
    unpairItem
  }
})
