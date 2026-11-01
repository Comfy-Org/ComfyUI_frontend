import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import type { LinearData } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { InputGroup } from '@comfyorg/graph-model/workflowSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useApp } from '@/scripts/appInstance'
import { ChangeTracker } from '@/scripts/changeTracker'
import { isWidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

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
    const seenGroups = new Set<string>()
    const seenWidgets = new Set<WidgetId>()
    inputGroups.value = (groups ?? []).flatMap((group) => {
      if (seenGroups.has(group.id)) return []
      seenGroups.add(group.id)
      const items = group.items.filter(({ key }) => {
        if (!isWidgetId(key) || seenWidgets.has(key)) return false
        seenWidgets.add(key)
        return true
      })
      const pairCounts = new Map<string, number>()
      for (const item of items) {
        if (item.pairId)
          pairCounts.set(item.pairId, (pairCounts.get(item.pairId) ?? 0) + 1)
      }
      return [{
        id: group.id,
        name: group.name,
        items: items.map(({ key, pairId }) =>
          pairId && pairCounts.get(pairId) === 2 ? { key, pairId } : { key }
        )
      }]
    })
  }

  function persistGroups(capture = true) {
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
    if (capture) workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
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

  function clearPair(group: InputGroup, pairId: string | undefined) {
    if (!pairId) return
    for (const item of group.items) {
      if (item.pairId === pairId) item.pairId = undefined
    }
  }

  function removeItemFromGroup(groupId: string, itemKey: WidgetId) {
    const group = findGroup(groupId)
    if (!group) return
    const idx = group.items.findIndex((i) => i.key === itemKey)
    if (idx === -1) return
    clearPair(group, group.items[idx].pairId)
    group.items.splice(idx, 1)
    if (group.items.length === 0) deleteGroupInternal(groupId)
    persistGroups()
  }

  function removeItemFromAllGroups(itemKey: WidgetId) {
    const emptied: string[] = []
    for (const group of inputGroups.value) {
      const idx = group.items.findIndex((i) => i.key === itemKey)
      if (idx !== -1) {
        clearPair(group, group.items[idx].pairId)
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
    const fromIdx = group.items.findIndex((item) => item.key === fromKey)
    const toIdx = group.items.findIndex((item) => item.key === toKey)
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return

    clearPair(group, group.items[fromIdx].pairId)
    const [moved] = group.items.splice(fromIdx, 1)
    const target = group.items.findIndex((item) => item.key === toKey)
    group.items.splice(target + (position === 'after' ? 1 : 0), 0, moved)
    persistGroups()
  }

  function pairItems(
    group: InputGroup,
    first: InputGroup['items'][number],
    second: InputGroup['items'][number]
  ) {
    clearPair(group, first.pairId)
    clearPair(group, second.pairId)
    const pairId = crypto.randomUUID()
    first.pairId = pairId
    second.pairId = pairId
  }

  function pairItemsInGroup(groupId: string, firstKey: WidgetId, secondKey: WidgetId) {
    const group = findGroup(groupId)
    if (!group) return
    const first = group.items.find((item) => item.key === firstKey)
    const second = group.items.find((item) => item.key === secondKey)
    if (!first || !second || first === second) return
    pairItems(group, first, second)
    persistGroups()
  }

  function replaceInPair(groupId: string, targetKey: WidgetId, replacementKey: WidgetId) {
    const group = findGroup(groupId)
    if (!group) return
    const target = group.items.find((item) => item.key === targetKey)
    if (!target?.pairId || targetKey === replacementKey) return
    const partnerIdx = group.items.findIndex((item) => item.key === replacementKey)
    if (partnerIdx < 0 || group.items[partnerIdx].pairId === target.pairId) return
    const [replacement] = group.items.splice(partnerIdx, 1)
    clearPair(group, replacement.pairId)
    const targetIdx = group.items.findIndex((item) => item.key === targetKey)
    replacement.pairId = target.pairId
    group.items.splice(targetIdx, 0, replacement)
    target.pairId = undefined
    persistGroups()
  }

  function moveItemToGroupAt(
    groupId: string,
    itemKey: WidgetId,
    targetKey: WidgetId,
    position: 'before' | 'center' | 'after'
  ) {
    const group = findGroup(groupId)
    if (!group || itemKey === targetKey) return
    const target = group.items.find((item) => item.key === targetKey)
    if (!target) return

    removeItemFromAllGroups(itemKey)
    const moved = { key: itemKey } as InputGroup['items'][number]
    const targetIndex = group.items.indexOf(target)
    group.items.splice(targetIndex + (position === 'after' ? 1 : 0), 0, moved)
    if (position === 'center') pairItems(group, moved, target)
    persistGroups()
  }

  function unpairItem(groupId: string, itemKey: WidgetId) {
    const group = findGroup(groupId)
    const item = group?.items.find((entry) => entry.key === itemKey)
    if (!group || !item?.pairId) return
    clearPair(group, item.pairId)
    persistGroups()
  }

  /**
   * One drag operation updates group membership and selected-input ordering.
   * Defer the history capture to appModeStore's existing selection watcher,
   * so dropping a grouped widget outside a group creates one undo entry.
   */
  function moveToUngrouped(
    itemKey: WidgetId,
    targetKey?: WidgetId,
    position: 'before' | 'after' = 'after'
  ) {
    const appModeStore = useAppModeStore()
    const inputIndex = appModeStore.selectedInputs.findIndex(([id]) => id === itemKey)
    if (inputIndex < 0 || itemKey === targetKey) return
    if (targetKey && isGrouped(targetKey)) return

    const next = [...appModeStore.selectedInputs]
    const [input] = next.splice(inputIndex, 1)
    let targetIndex = targetKey
      ? next.findIndex(([id]) => id === targetKey)
      : next.length
    if (targetIndex < 0) return
    if (targetKey && position === 'after') targetIndex += 1
    const wasGrouped = isGrouped(itemKey)
    if (!wasGrouped && inputIndex === targetIndex) return

    if (wasGrouped) removeItemFromAllGroups(itemKey)
    next.splice(targetIndex, 0, input)
    appModeStore.selectedInputs = next
    if (wasGrouped) persistGroups(false)
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
    pairItemsInGroup,
    replaceInPair,
    moveItemToGroupAt,
    unpairItem,
    moveToUngrouped
  }
})
