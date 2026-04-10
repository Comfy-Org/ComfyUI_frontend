import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { inputItemKey } from '@/components/builder/itemKeyHelper'
import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  InputGroup,
  LinearData
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'

export const useInputGroupStore = defineStore('inputGroup', () => {
  const workflowStore = useWorkflowStore()
  const { isBuilderMode, isAppMode } = useAppMode()

  const inputGroups = ref<InputGroup[]>([])

  const groupedItemKeys = computed(() => {
    const keys = new Set<string>()
    for (const group of inputGroups.value) {
      for (const item of group.items) keys.add(item.key)
    }
    return keys
  })

  function isGrouped(nodeId: NodeId, widgetName: string): boolean {
    return groupedItemKeys.value.has(inputItemKey(nodeId, widgetName))
  }

  // ── Persistence ────────────────────────────────────────────────────

  function loadGroups(groups: InputGroup[] | undefined) {
    inputGroups.value = groups
      ? groups.map((g) => ({ ...g, items: [...g.items] }))
      : []
  }

  function persistGroups() {
    if (
      (!isBuilderMode.value && !isAppMode.value) ||
      ChangeTracker.isLoadingGraph
    )
      return
    const graph = app.rootGraph
    if (!graph) return
    const extra = (graph.extra ??= {})
    const linearData = ((extra.linearData as LinearData | undefined) ??= {
      inputs: [],
      outputs: []
    })
    linearData.inputGroups = inputGroups.value.length
      ? JSON.parse(JSON.stringify(inputGroups.value))
      : undefined
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  function reloadFromGraph() {
    const linearData = app.rootGraph?.extra?.linearData as
      | LinearData
      | undefined
    loadGroups(linearData?.inputGroups)
  }

  watch(
    () => workflowStore.activeWorkflow,
    (workflow) => {
      const linearData = workflow?.changeTracker?.activeState?.extra
        ?.linearData as LinearData | undefined
      loadGroups(linearData?.inputGroups)
    },
    { immediate: true }
  )

  useEventListener(() => app.rootGraph?.events, 'configured', reloadFromGraph)

  // ── Helpers ────────────────────────────────────────────────────────

  function findGroup(groupId: string): InputGroup | undefined {
    return inputGroups.value.find((g) => g.id === groupId)
  }

  // ── Actions ────────────────────────────────────────────────────────

  function createGroup(name?: string): string {
    const id = crypto.randomUUID()
    inputGroups.value.push({ id, name: name ?? null, items: [] })
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

  function addItemToGroup(groupId: string, itemKey: string) {
    const group = findGroup(groupId)
    if (!group) return
    if (group.items.some((i) => i.key === itemKey)) return
    // Remove from any other group first
    removeItemFromAllGroups(itemKey)
    group.items.push({ key: itemKey })
    persistGroups()
  }

  function removeItemFromGroup(groupId: string, itemKey: string) {
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

  function removeItemFromAllGroups(itemKey: string) {
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
    fromKey: string,
    toKey: string,
    position: 'before' | 'after'
  ) {
    const group = findGroup(groupId)
    if (!group) return
    const fromIdx = group.items.findIndex((i) => i.key === fromKey)
    const toIdx = group.items.findIndex((i) => i.key === toKey)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
    const [moved] = group.items.splice(fromIdx, 1)
    const insertIdx =
      position === 'before'
        ? group.items.findIndex((i) => i.key === toKey)
        : group.items.findIndex((i) => i.key === toKey) + 1
    group.items.splice(insertIdx, 0, moved)
    persistGroups()
  }

  function pairItemsInGroup(groupId: string, keyA: string, keyB: string) {
    const group = findGroup(groupId)
    if (!group) return
    const itemA = group.items.find((i) => i.key === keyA)
    const itemB = group.items.find((i) => i.key === keyB)
    if (itemA?.pairId) clearPair(group, itemA.pairId)
    if (itemB?.pairId) clearPair(group, itemB.pairId)
    const pairId = crypto.randomUUID()
    for (const item of group.items) {
      if (item.key === keyA || item.key === keyB) item.pairId = pairId
    }
    persistGroups()
  }

  /**
   * Swap a dragged item into an existing pair slot, evicting the target.
   * 1. Detach replacement from its current position (and dissolve its old pair)
   * 2. Insert replacement next to the target, inheriting the target's pairId
   * 3. Unpair the evicted target
   */
  function replaceInPair(
    groupId: string,
    targetKey: string,
    replacementKey: string
  ) {
    const group = findGroup(groupId)
    if (!group) return
    const targetItem = group.items.find((i) => i.key === targetKey)
    if (!targetItem?.pairId) return
    const pairId = targetItem.pairId
    const repIdx = group.items.findIndex((i) => i.key === replacementKey)
    if (repIdx === -1) return
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

  /** Move an item from any group into a target group near a specific item. */
  function moveItemToGroupAt(
    groupId: string,
    itemKey: string,
    targetKey: string,
    position: 'before' | 'center' | 'after'
  ) {
    const group = findGroup(groupId)
    if (!group) return
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

  function unpairItem(groupId: string, itemKey: string) {
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
    groupedItemKeys,
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
