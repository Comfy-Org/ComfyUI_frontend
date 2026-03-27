import { defineStore } from 'pinia'
import { reactive, computed, ref, watch } from 'vue'

import { useEmptyWorkflowDialog } from '@/components/builder/useEmptyWorkflowDialog'
import {
  getTemplate,
  LAYOUT_TEMPLATES
} from '@/components/builder/layoutTemplates'
import type {
  GridOverride,
  LayoutTemplateId
} from '@/components/builder/layoutTemplates'
import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  AppModePreset,
  InputGroup,
  InputGroupItem,
  LinearData,
  PresetDisplayMode,
  WidgetOverride
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { resolveNode } from '@/utils/litegraphUtil'

export function nodeTypeValidForApp(type: string) {
  return !['Note', 'MarkdownNote'].includes(type)
}

/** Deep clone a Vue reactive object by stripping proxies via JSON round-trip.
 *  structuredClone() cannot handle Vue reactive proxies. */
function deepCloneReactive<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export const useAppModeStore = defineStore('appMode', () => {
  const { getCanvas } = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const { mode, setMode, isBuilderMode, isAppMode, isSelectMode } = useAppMode()
  const emptyWorkflowDialog = useEmptyWorkflowDialog()

  const selectedInputs = ref<[NodeId, string][]>([])
  const selectedOutputs = ref<NodeId[]>([])
  const layoutTemplateId = ref<LayoutTemplateId>('single')
  const zoneAssignmentsPerTemplate = reactive<
    Record<string, Record<string, string>>
  >({})
  const gridOverridesPerTemplate = reactive<Record<string, GridOverride>>({})
  const runControlsZoneIdPerTemplate = reactive<Record<string, string>>({})
  const presetStripZoneIdPerTemplate = reactive<Record<string, string>>({})
  /** Per-zone item order — unified list of item keys per zone, per template. */
  const zoneItemOrderPerTemplate = reactive<
    Record<string, Record<string, string[]>>
  >({})
  /** Per-widget overrides (min/max, display type). Keyed by `nodeId:widgetName`. */
  const widgetOverrides = reactive<Record<string, WidgetOverride>>({})
  /** Collapsible input groups per layout template. */
  const inputGroupsPerTemplate = reactive<Record<string, InputGroup[]>>({})
  /** Per-input color names. Keyed by `nodeId:widgetName`. */
  const inputColors = reactive<Record<string, string>>({})
  /** Saved presets for quick input value switching. */
  const presets = reactive<AppModePreset[]>([])
  /** Whether the preset strip is visible in app mode. */
  const presetsEnabled = ref(true)
  /** How the preset switcher renders in app view. */
  const presetDisplayMode = ref<PresetDisplayMode>('tabs')

  const zoneAssignments = computed(
    () => zoneAssignmentsPerTemplate[layoutTemplateId.value] ?? {}
  )
  const gridOverrides = computed<GridOverride | undefined>(
    () => gridOverridesPerTemplate[layoutTemplateId.value]
  )
  const runControlsZoneId = computed(() => {
    const stored = runControlsZoneIdPerTemplate[layoutTemplateId.value]
    if (stored) return stored
    const tmpl = getTemplate(layoutTemplateId.value)
    if (tmpl?.defaultRunControlsZone) return tmpl.defaultRunControlsZone
    const zones = tmpl?.zones ?? []
    return zones.at(-1)?.id ?? ''
  })
  const presetStripZoneId = computed(() => {
    const stored = presetStripZoneIdPerTemplate[layoutTemplateId.value]
    if (stored) return stored
    const tmpl = getTemplate(layoutTemplateId.value)
    if (tmpl?.defaultPresetStripZone) return tmpl.defaultPresetStripZone
    const zones = tmpl?.zones ?? []
    return zones.at(0)?.id ?? ''
  })
  const zoneItemOrder = computed(
    () => zoneItemOrderPerTemplate[layoutTemplateId.value] ?? {}
  )
  const inputGroups = computed(
    () => inputGroupsPerTemplate[layoutTemplateId.value] ?? []
  )
  const hasOutputs = computed(() => !!selectedOutputs.value.length)
  const hasNodes = computed(() => {
    // Nodes are not reactive, so trigger recomputation when workflow changes
    void workflowStore.activeWorkflow
    void mode.value
    return !!app.rootGraph?.nodes?.length
  })

  // Prune entries referencing nodes deleted in workflow mode.
  // Only check node existence, not widgets — dynamic widgets can
  // hide/show other widgets so a missing widget does not mean stale data.
  function zoneKey(nodeId: NodeId, widgetName: string): string {
    return `${nodeId}:${widgetName}`
  }

  function getZone(nodeId: NodeId, widgetName: string): string | undefined {
    return zoneAssignments.value[zoneKey(nodeId, widgetName)]
  }

  function ensureTemplateAssignments(): Record<string, string> {
    const tid = layoutTemplateId.value
    if (!zoneAssignmentsPerTemplate[tid]) {
      zoneAssignmentsPerTemplate[tid] = {}
    }
    return zoneAssignmentsPerTemplate[tid]
  }

  function setZone(nodeId: NodeId, widgetName: string, zoneId: string) {
    ensureTemplateAssignments()[zoneKey(nodeId, widgetName)] = zoneId
    persistLinearData()
  }

  function setGridOverrides(overrides: GridOverride | undefined) {
    const tid = layoutTemplateId.value
    if (overrides) {
      gridOverridesPerTemplate[tid] = overrides
    } else {
      delete gridOverridesPerTemplate[tid]
    }
    persistLinearData()
  }

  function setRunControlsZone(zoneId: string) {
    runControlsZoneIdPerTemplate[layoutTemplateId.value] = zoneId
    persistLinearData()
  }

  function setPresetStripZone(zoneId: string) {
    presetStripZoneIdPerTemplate[layoutTemplateId.value] = zoneId
    persistLinearData()
  }

  /** Assign unassigned inputs to the least-full input zone and persist. */
  function autoAssignInputs() {
    const tmpl = getTemplate(layoutTemplateId.value)
    if (!tmpl) return
    const { zones } = tmpl
    if (zones.length === 0) return

    const assignments = ensureTemplateAssignments()
    for (const [nodeId, widgetName] of selectedInputs.value) {
      const key = zoneKey(nodeId, widgetName)
      if (assignments[key]) continue
      const counts = new Map<string, number>()
      for (const z of zones) counts.set(z.id, 0)
      for (const [nId, wName] of selectedInputs.value) {
        const assigned = assignments[zoneKey(nId, wName)]
        if (assigned && counts.has(assigned)) {
          counts.set(assigned, (counts.get(assigned) ?? 0) + 1)
        }
      }
      const leastFull = [...counts.entries()].sort((a, b) => a[1] - b[1])[0]
      if (leastFull) assignments[key] = leastFull[0]
    }
    persistLinearData()
  }

  /** Switch to a new template, redistributing inputs/outputs for the new layout. */
  function switchTemplate(newId: LayoutTemplateId) {
    const prevId = layoutTemplateId.value
    layoutTemplateId.value = newId
    const tmpl = getTemplate(newId)
    if (!tmpl) return

    const newZoneIds = tmpl.zones.map((z) => z.id)
    const defaultNewZone = newZoneIds[0] ?? ''

    function remapZoneId(oldZone: string): string {
      if (newZoneIds.includes(oldZone)) return oldZone
      return defaultNewZone
    }

    // Only seed the target template from the source when it has no data yet.
    // This preserves work done in each layout independently.
    const hasExistingGroups = !!inputGroupsPerTemplate[newId]?.length
    const hasExistingOrder = !!Object.keys(
      zoneItemOrderPerTemplate[newId] ?? {}
    ).length

    if (!hasExistingGroups) {
      const prevGroups = inputGroupsPerTemplate[prevId]
      if (prevGroups?.length) {
        inputGroupsPerTemplate[newId] = prevGroups.map((g) => ({
          ...g,
          items: [...g.items]
        }))
      }
    }

    if (!hasExistingOrder) {
      const prevOrder = zoneItemOrderPerTemplate[prevId]
      if (prevOrder) {
        const remapped: Record<string, string[]> = {}
        for (const [oldZone, keys] of Object.entries(prevOrder)) {
          const target = remapZoneId(oldZone)
          remapped[target] = [...(remapped[target] ?? []), ...keys]
        }
        zoneItemOrderPerTemplate[newId] = remapped
      }
    }

    if (!zoneAssignmentsPerTemplate[newId]) {
      const prevAssignments = zoneAssignmentsPerTemplate[prevId]
      if (prevAssignments) {
        const remapped: Record<string, string> = {}
        for (const [key, zone] of Object.entries(prevAssignments)) {
          remapped[key] = remapZoneId(zone)
        }
        zoneAssignmentsPerTemplate[newId] = remapped
      }
    }

    const assignments = ensureTemplateAssignments()
    const validZoneIds = new Set(newZoneIds)

    // Clear stale zone assignments for this template
    for (const key of Object.keys(assignments)) {
      if (!validZoneIds.has(assignments[key])) {
        delete assignments[key]
      }
    }

    autoAssignInputs()
    persistLinearData()
  }

  function pruneLinearData(data: Partial<LinearData> | undefined): LinearData {
    const rawInputs = data?.inputs ?? []
    const rawOutputs = data?.outputs ?? []

    return {
      inputs: app.rootGraph
        ? rawInputs.filter(([nodeId]) => resolveNode(nodeId))
        : rawInputs,
      outputs: app.rootGraph
        ? rawOutputs.filter((nodeId) => resolveNode(nodeId))
        : rawOutputs,
      layoutTemplateId: data?.layoutTemplateId,
      zoneAssignmentsPerTemplate:
        data?.zoneAssignmentsPerTemplate ??
        (data?.zoneAssignments && data?.layoutTemplateId
          ? { [data.layoutTemplateId]: data.zoneAssignments }
          : undefined),
      gridOverridesPerTemplate:
        data?.gridOverridesPerTemplate ??
        (data?.gridOverrides && data?.layoutTemplateId
          ? { [data.layoutTemplateId]: data.gridOverrides }
          : undefined),
      runControlsZoneIdPerTemplate:
        data?.runControlsZoneIdPerTemplate ??
        (data?.runControlsZoneId && data?.layoutTemplateId
          ? { [data.layoutTemplateId]: data.runControlsZoneId }
          : undefined),
      presetStripZoneIdPerTemplate: data?.presetStripZoneIdPerTemplate,
      zoneItemOrderPerTemplate: data?.zoneItemOrderPerTemplate,
      widgetOverrides: data?.widgetOverrides,
      presets: data?.presets,
      presetDisplayMode: data?.presetDisplayMode,
      presetsEnabled: data?.presetsEnabled,
      inputGroupsPerTemplate: data?.inputGroupsPerTemplate,
      inputColors: data?.inputColors
    }
  }

  function replaceReactive(
    target: Record<string, unknown>,
    source: Record<string, unknown> | undefined
  ) {
    Object.keys(target).forEach((k) => delete target[k])
    Object.assign(target, source ?? {})
  }

  function loadSelections(data: Partial<LinearData> | undefined) {
    const pruned = pruneLinearData(data)
    selectedInputs.value = pruned.inputs
    selectedOutputs.value = pruned.outputs
    const VALID_TEMPLATE_IDS: Set<string> = new Set(
      LAYOUT_TEMPLATES.map((t) => t.id)
    )
    layoutTemplateId.value = VALID_TEMPLATE_IDS.has(
      pruned.layoutTemplateId ?? ''
    )
      ? (pruned.layoutTemplateId as LayoutTemplateId)
      : 'single'
    replaceReactive(
      zoneAssignmentsPerTemplate,
      pruned.zoneAssignmentsPerTemplate
    )
    replaceReactive(gridOverridesPerTemplate, pruned.gridOverridesPerTemplate)
    replaceReactive(
      runControlsZoneIdPerTemplate,
      pruned.runControlsZoneIdPerTemplate
    )
    replaceReactive(
      presetStripZoneIdPerTemplate,
      pruned.presetStripZoneIdPerTemplate
    )
    replaceReactive(zoneItemOrderPerTemplate, pruned.zoneItemOrderPerTemplate)
    replaceReactive(widgetOverrides, pruned.widgetOverrides)
    replaceReactive(inputGroupsPerTemplate, pruned.inputGroupsPerTemplate)
    replaceReactive(inputColors, pruned.inputColors)

    presets.splice(0, presets.length, ...(pruned.presets ?? []))
    presetDisplayMode.value = pruned.presetDisplayMode ?? 'tabs'
    presetsEnabled.value = pruned.presetsEnabled ?? true
  }

  function resetSelectedToWorkflow() {
    const { activeWorkflow } = workflowStore
    if (!activeWorkflow) return

    loadSelections(activeWorkflow.changeTracker?.activeState?.extra?.linearData)
  }

  watch(
    () => workflowStore.activeWorkflow,
    (newWorkflow) => {
      if (newWorkflow) {
        loadSelections(
          newWorkflow.changeTracker?.activeState?.extra?.linearData
        )
      } else {
        loadSelections(undefined)
      }
    },
    { immediate: true }
  )

  function persistLinearData() {
    if (
      (!isBuilderMode.value && !isAppMode.value) ||
      ChangeTracker.isLoadingGraph
    )
      return
    const graph = app.rootGraph
    if (!graph) return
    const extra = (graph.extra ??= {})
    extra.linearData = {
      inputs: [...selectedInputs.value],
      outputs: [...selectedOutputs.value],
      layoutTemplateId: layoutTemplateId.value,
      zoneAssignmentsPerTemplate: deepCloneReactive(zoneAssignmentsPerTemplate),
      gridOverridesPerTemplate: deepCloneReactive(gridOverridesPerTemplate),
      runControlsZoneIdPerTemplate: { ...runControlsZoneIdPerTemplate },
      presetStripZoneIdPerTemplate: { ...presetStripZoneIdPerTemplate },
      zoneItemOrderPerTemplate: deepCloneReactive(zoneItemOrderPerTemplate),
      widgetOverrides: Object.keys(widgetOverrides).length
        ? deepCloneReactive(widgetOverrides)
        : undefined,
      presets: presets.length ? deepCloneReactive(presets) : undefined,
      presetDisplayMode:
        presetDisplayMode.value !== 'tabs'
          ? presetDisplayMode.value
          : undefined,
      presetsEnabled: presetsEnabled.value ? undefined : false,
      inputGroupsPerTemplate: Object.keys(inputGroupsPerTemplate).length
        ? deepCloneReactive(inputGroupsPerTemplate)
        : undefined,
      inputColors: Object.keys(inputColors).length
        ? { ...inputColors }
        : undefined
    }
    workflowStore.activeWorkflow?.changeTracker.checkState()
  }

  watch(
    () =>
      isBuilderMode.value
        ? {
            inputs: [...selectedInputs.value],
            outputs: [...selectedOutputs.value]
          }
        : null,
    (data) => {
      if (data) persistLinearData()
    },
    { deep: true }
  )

  let unwatch: (() => void) | undefined
  watch(isSelectMode, (inSelect) => {
    const { state } = getCanvas()
    if (!state) return
    state.readOnly = inSelect
    unwatch?.()
    if (inSelect)
      unwatch = watch(
        () => state.readOnly,
        () => (state.readOnly = true)
      )
  })

  function enterBuilder() {
    if (!hasNodes.value) {
      emptyWorkflowDialog.show({
        onEnterBuilder: () => enterBuilder(),
        onDismiss: () => setMode('graph')
      })
      return
    }

    useSidebarTabStore().activeSidebarTabId = null

    setMode(
      mode.value === 'app' && hasOutputs.value
        ? 'builder:arrange'
        : 'builder:inputs'
    )
  }

  function exitBuilder() {
    resetSelectedToWorkflow()
    setMode('graph')
  }

  /** Get the ordered item keys for a zone, auto-populating from current items if empty. */
  function getZoneItems(
    zoneId: string,
    outputs: { nodeId: NodeId }[],
    widgets: { nodeId: NodeId; widgetName: string }[],
    hasRunControls: boolean,
    hasPresetStrip: boolean = false
  ): string[] {
    const existing = zoneItemOrder.value[zoneId]
    if (existing && existing.length > 0) {
      // Filter out stale keys that no longer exist, append new ones
      const validKeys = new Set<string>()
      // Collect keys that live inside groups so they stay out of the flat zone order
      const inGroupKeys = new Set<string>()
      for (const g of inputGroups.value) {
        // Only treat group as valid in this zone if it's already in this zone's order
        const groupKey = `group:${g.id}`
        if (existing.includes(groupKey)) validKeys.add(groupKey)
        for (const item of g.items) inGroupKeys.add(item.key)
      }
      if (hasPresetStrip) validKeys.add('preset-strip')
      for (const o of outputs) validKeys.add(`output:${o.nodeId}`)
      for (const w of widgets) {
        const key = `input:${w.nodeId}:${w.widgetName}`
        if (!inGroupKeys.has(key)) validKeys.add(key)
      }
      if (hasRunControls) validKeys.add('run-controls')

      const kept: string[] = []
      const seen = new Set<string>()
      for (const k of existing) {
        if (validKeys.has(k) && !seen.has(k)) {
          kept.push(k)
          seen.add(k)
        }
      }
      // Append new keys — insert inputs/outputs before first group
      let insertIdx = kept.findIndex((k) => k.startsWith('group:'))
      for (const k of validKeys) {
        if (!seen.has(k)) {
          if (
            (k.startsWith('input:') || k.startsWith('output:')) &&
            insertIdx >= 0
          ) {
            kept.splice(insertIdx, 0, k)
            insertIdx++
          } else {
            kept.push(k)
          }
          seen.add(k)
        }
      }
      return kept
    }
    // Default order: preset strip, outputs, inputs, run controls
    const keys: string[] = []
    const inGroupKeys = new Set<string>()
    for (const g of inputGroups.value) {
      for (const item of g.items) inGroupKeys.add(item.key)
    }
    if (hasPresetStrip) keys.push('preset-strip')
    for (const o of outputs) keys.push(`output:${o.nodeId}`)
    for (const w of widgets) {
      const key = `input:${w.nodeId}:${w.widgetName}`
      if (!inGroupKeys.has(key)) keys.push(key)
    }
    // Infer group placement: groups with items assigned to this zone
    // (or the default zone) are surfaced even without saved order data.
    for (const g of inputGroups.value) {
      const firstInputItem = g.items.find((i) => i.key.startsWith('input:'))
      if (firstInputItem) {
        const parts = firstInputItem.key.split(':')
        const assignedZone =
          zoneAssignments.value[`${parts[1]}:${parts.slice(2).join(':')}`]
        const tmpl = getTemplate(layoutTemplateId.value)
        const defaultZoneId = tmpl?.zones[0]?.id
        if (
          assignedZone === zoneId ||
          (!assignedZone && zoneId === defaultZoneId)
        )
          keys.push(`group:${g.id}`)
      } else {
        // Empty groups or groups with non-input items go to default zone
        const tmpl = getTemplate(layoutTemplateId.value)
        const defaultZoneId = tmpl?.zones[0]?.id
        if (zoneId === defaultZoneId) keys.push(`group:${g.id}`)
      }
    }
    if (hasRunControls) keys.push('run-controls')
    return keys
  }

  /** Reorder any item relative to any other item within the same zone. */
  function reorderZoneItem(
    zoneId: string,
    fromKey: string,
    toKey: string,
    position: 'before' | 'after',
    currentOrder: string[]
  ) {
    const order = [...currentOrder]
    const fromIdx = order.indexOf(fromKey)
    const toIdx = order.indexOf(toKey)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return

    order.splice(fromIdx, 1)
    const insertIdx =
      position === 'before' ? order.indexOf(toKey) : order.indexOf(toKey) + 1
    order.splice(insertIdx, 0, fromKey)

    const tid = layoutTemplateId.value
    if (!zoneItemOrderPerTemplate[tid]) {
      zoneItemOrderPerTemplate[tid] = {}
    }
    zoneItemOrderPerTemplate[tid][zoneId] = order
    persistLinearData()
  }

  // ── Unified drag-and-drop move ──────────────────────────────────────

  /** Remove an item from wherever it currently lives (group or zone order). */
  function detachWidgetItem(itemKey: string) {
    const sourceGroup = getGroupForItem(itemKey)
    if (sourceGroup) {
      const idx = sourceGroup.items.findIndex((i) => i.key === itemKey)
      if (idx !== -1) {
        // Clear pair membership before removal
        const pairId = sourceGroup.items[idx].pairId
        if (pairId) {
          for (const i of sourceGroup.items) {
            if (i.pairId === pairId) i.pairId = undefined
          }
        }
        sourceGroup.items.splice(idx, 1)
      }
      if (sourceGroup.items.length === 0) deleteGroup(sourceGroup.id)
      return
    }
    // Remove from all zone orders
    const tid = layoutTemplateId.value
    const allOrders = zoneItemOrderPerTemplate[tid]
    if (allOrders) {
      for (const order of Object.values(allOrders)) {
        const idx = order.indexOf(itemKey)
        if (idx !== -1) order.splice(idx, 1)
      }
    }
  }

  /** Get a mutable zone order, initializing if needed. */
  function ensureMutableZoneOrder(zoneId: string): string[] {
    const tid = layoutTemplateId.value
    if (!zoneItemOrderPerTemplate[tid]) zoneItemOrderPerTemplate[tid] = {}
    if (!zoneItemOrderPerTemplate[tid][zoneId])
      zoneItemOrderPerTemplate[tid][zoneId] = []
    return zoneItemOrderPerTemplate[tid][zoneId]
  }

  /** Place an item in a zone order. If target/edge provided, insert relative to it. */
  function placeZoneItem(
    zoneId: string,
    itemKey: string,
    target?: { key: string; edge: 'before' | 'after' }
  ) {
    const order = ensureMutableZoneOrder(zoneId)
    // Defensively remove duplicates
    const existing = order.indexOf(itemKey)
    if (existing !== -1) order.splice(existing, 1)

    if (target) {
      const targetIdx = order.indexOf(target.key)
      if (targetIdx !== -1) {
        const insertIdx = target.edge === 'after' ? targetIdx + 1 : targetIdx
        order.splice(insertIdx, 0, itemKey)
        return
      }
    }
    // Fallback: insert before run-controls
    const runIdx = order.indexOf('run-controls')
    if (runIdx !== -1) order.splice(runIdx, 0, itemKey)
    else order.push(itemKey)
  }

  /** Unified move: detach from source, place at destination, persist once. */
  function moveWidgetItem(
    itemKey: string,
    dest:
      | { kind: 'zone'; zoneId: string }
      | {
          kind: 'zone-relative'
          zoneId: string
          targetKey: string
          edge: 'before' | 'after'
        }
      | { kind: 'zone-pair'; zoneId: string; targetKey: string }
      | { kind: 'group'; zoneId: string; groupId: string; position?: number }
      | {
          kind: 'group-relative'
          zoneId: string
          groupId: string
          targetKey: string
          edge: 'before' | 'after' | 'center'
        }
  ) {
    switch (dest.kind) {
      case 'zone':
        detachWidgetItem(itemKey)
        placeZoneItem(dest.zoneId, itemKey)
        break

      case 'zone-relative':
        detachWidgetItem(itemKey)
        placeZoneItem(dest.zoneId, itemKey, {
          key: dest.targetKey,
          edge: dest.edge
        })
        break

      case 'zone-pair': {
        // Capture target position BEFORE any detach
        const order = ensureMutableZoneOrder(dest.zoneId)
        const targetIdx = order.indexOf(dest.targetKey)

        detachWidgetItem(itemKey)
        detachWidgetItem(dest.targetKey)

        const groupId = crypto.randomUUID()
        ensureTemplateGroups().push({
          id: groupId,
          name: null,
          items: [{ key: dest.targetKey }, { key: itemKey }]
        })
        const pairId = crypto.randomUUID()
        const group = findGroup(groupId)!
        for (const i of group.items) i.pairId = pairId

        // Insert group key where the target was (adjusted for removals)
        const groupKey = `group:${groupId}`
        const freshOrder = ensureMutableZoneOrder(dest.zoneId)
        const clampedIdx = Math.min(Math.max(targetIdx, 0), freshOrder.length)
        freshOrder.splice(clampedIdx, 0, groupKey)
        break
      }

      case 'group': {
        detachWidgetItem(itemKey)
        const group = findGroup(dest.groupId)
        if (!group) break
        const newItem: InputGroupItem = { key: itemKey }
        if (dest.position !== undefined && dest.position >= 0)
          group.items.splice(dest.position, 0, newItem)
        else group.items.push(newItem)
        break
      }

      case 'group-relative': {
        const group = findGroup(dest.groupId)
        if (!group) break
        const sameGroup = group.items.some((i) => i.key === itemKey)

        if (sameGroup) {
          // Reorder within same group — no detach needed
          if (dest.edge === 'center') {
            const targetItem = group.items.find((i) => i.key === dest.targetKey)
            if (targetItem?.pairId) {
              // Target is paired — swap: take its position and pairId
              replaceInPair(dest.groupId, dest.targetKey, itemKey)
            } else {
              pairItemsInGroup(dest.groupId, dest.targetKey, itemKey)
            }
          } else {
            unpairItem(dest.groupId, itemKey)
            reorderWithinGroup(dest.groupId, itemKey, dest.targetKey, dest.edge)
          }
        } else {
          // Coming from outside — detach first, then insert
          detachWidgetItem(itemKey)
          const targetIdx = group.items.findIndex(
            (i) => i.key === dest.targetKey
          )
          const insertIdx =
            dest.edge === 'after' && targetIdx !== -1
              ? targetIdx + 1
              : Math.max(targetIdx, 0)
          group.items.splice(insertIdx, 0, { key: itemKey })
          if (dest.edge === 'center') {
            pairItemsInGroup(dest.groupId, dest.targetKey, itemKey)
          }
        }
        break
      }
    }

    persistLinearData()
  }

  // --- Input group methods ---

  function ensureTemplateGroups(): InputGroup[] {
    const tid = layoutTemplateId.value
    if (!inputGroupsPerTemplate[tid]) inputGroupsPerTemplate[tid] = []
    return inputGroupsPerTemplate[tid]
  }

  function findGroup(groupId: string): InputGroup | undefined {
    return inputGroups.value.find((g) => g.id === groupId)
  }

  function getGroupForItem(itemKey: string): InputGroup | undefined {
    return inputGroups.value.find((g) => g.items.some((i) => i.key === itemKey))
  }

  function createGroup(zoneId: string): string {
    const id = crypto.randomUUID()
    const groupKey = `group:${id}`

    // Add group to the current template only; other templates will pick it up
    // naturally via getZoneItems' default-order path when they become active.
    ensureTemplateGroups().push({ id, name: null, items: [] })

    const tid = layoutTemplateId.value
    if (!zoneItemOrderPerTemplate[tid]) zoneItemOrderPerTemplate[tid] = {}

    // Materialize zone order if empty so the group lands at the end
    if (!zoneItemOrderPerTemplate[tid][zoneId]?.length) {
      const tmpl = getTemplate(tid)
      const defaultZoneId = tmpl?.zones[0]?.id
      const widgets = selectedInputs.value
        .filter(([nId, wName]) => {
          const assigned = getZone(nId, wName)
          return assigned ? assigned === zoneId : zoneId === defaultZoneId
        })
        .map(([nId, wName]) => ({ nodeId: nId, widgetName: wName }))
      const hasRun = runControlsZoneId.value === zoneId
      zoneItemOrderPerTemplate[tid][zoneId] = getZoneItems(
        zoneId,
        [],
        widgets,
        hasRun
      )
    }

    // Append group at the very bottom, only before run-controls
    const order = zoneItemOrderPerTemplate[tid][zoneId]
    const runIdx = order.indexOf('run-controls')
    if (runIdx !== -1) order.splice(runIdx, 0, groupKey)
    else order.push(groupKey)

    persistLinearData()
    return id
  }

  function addItemToGroup(
    groupId: string,
    itemKey: string,
    zoneId: string,
    position?: number
  ) {
    const group = findGroup(groupId)
    if (!group) return
    const tid = layoutTemplateId.value
    const order = zoneItemOrderPerTemplate[tid]?.[zoneId]
    if (order) {
      const idx = order.indexOf(itemKey)
      if (idx !== -1) order.splice(idx, 1)
    }
    const newItem: InputGroupItem = { key: itemKey }
    if (position !== undefined && position >= 0)
      group.items.splice(position, 0, newItem)
    else group.items.push(newItem)
    persistLinearData()
  }

  function removeItemFromGroup(
    groupId: string,
    itemKey: string,
    zoneId: string,
    skipZoneOrder = false
  ) {
    const group = findGroup(groupId)
    if (!group) return
    const itemIdx = group.items.findIndex((i) => i.key === itemKey)
    if (itemIdx === -1) return
    const pairId = group.items[itemIdx].pairId
    if (pairId) {
      for (const i of group.items) {
        if (i.pairId === pairId) i.pairId = undefined
      }
    }
    group.items.splice(itemIdx, 1)
    if (!skipZoneOrder) {
      const tid = layoutTemplateId.value
      const order = zoneItemOrderPerTemplate[tid]?.[zoneId]
      if (order) {
        const groupKey = `group:${groupId}`
        const groupIdx = order.indexOf(groupKey)
        if (groupIdx !== -1) order.splice(groupIdx + 1, 0, itemKey)
        else order.push(itemKey)
      }
    }
    if (group.items.length === 0) deleteGroup(groupId)
    else persistLinearData()
  }

  function dissolveGroup(groupId: string, zoneId: string) {
    const group = findGroup(groupId)
    if (!group) return
    const tid = layoutTemplateId.value
    const order = zoneItemOrderPerTemplate[tid]?.[zoneId]
    if (order) {
      const groupKey = `group:${groupId}`
      const groupIdx = order.indexOf(groupKey)
      if (groupIdx !== -1) {
        order.splice(groupIdx, 1, ...group.items.map((i) => i.key))
      }
    }
    deleteGroup(groupId)
  }

  function deleteGroup(groupId: string) {
    const groups = ensureTemplateGroups()
    const idx = groups.findIndex((g) => g.id === groupId)
    if (idx !== -1) groups.splice(idx, 1)
    const tid = layoutTemplateId.value
    for (const zoneOrder of Object.values(
      zoneItemOrderPerTemplate[tid] ?? {}
    )) {
      const keyIdx = zoneOrder.indexOf(`group:${groupId}`)
      if (keyIdx !== -1) zoneOrder.splice(keyIdx, 1)
    }
    persistLinearData()
  }

  function moveGroupToZone(
    groupId: string,
    fromZoneId: string,
    toZoneId: string
  ) {
    const tid = layoutTemplateId.value
    const groupKey = `group:${groupId}`
    // Remove from source zone
    const fromOrder = zoneItemOrderPerTemplate[tid]?.[fromZoneId]
    if (fromOrder) {
      const idx = fromOrder.indexOf(groupKey)
      if (idx !== -1) fromOrder.splice(idx, 1)
    }
    // Add to target zone before run-controls
    if (!zoneItemOrderPerTemplate[tid]) zoneItemOrderPerTemplate[tid] = {}
    const toOrder = zoneItemOrderPerTemplate[tid][toZoneId] ?? []
    const runIdx = toOrder.indexOf('run-controls')
    if (runIdx !== -1) toOrder.splice(runIdx, 0, groupKey)
    else toOrder.push(groupKey)
    zoneItemOrderPerTemplate[tid][toZoneId] = toOrder
    // Update zone assignment for all child widgets
    const group = findGroup(groupId)
    if (group) {
      const assignments = ensureTemplateAssignments()
      for (const item of group.items) {
        if (item.key.startsWith('input:')) {
          const parts = item.key.split(':')
          assignments[`${parts[1]}:${parts.slice(2).join(':')}`] = toZoneId
        }
      }
    }
    persistLinearData()
  }

  function renameGroup(groupId: string, name: string | null) {
    const group = findGroup(groupId)
    if (!group) return
    group.name = name
    persistLinearData()
  }

  function setGroupColor(groupId: string, color: string | null) {
    const group = findGroup(groupId)
    if (!group) return
    group.color = color
    persistLinearData()
  }

  function setInputColor(
    nodeId: NodeId,
    widgetName: string,
    color: string | null
  ) {
    const key = `${nodeId}:${widgetName}`
    if (color) inputColors[key] = color
    else delete inputColors[key]
    persistLinearData()
  }

  function getInputColor(
    nodeId: NodeId,
    widgetName: string
  ): string | undefined {
    return inputColors[`${nodeId}:${widgetName}`]
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
    persistLinearData()
  }

  function pairItemsInGroup(
    groupId: string,
    targetKey: string,
    droppedKey: string
  ) {
    const group = findGroup(groupId)
    if (!group) return
    // Dissolve existing pairs so old partners aren't left orphaned
    unpairItem(groupId, targetKey)
    unpairItem(groupId, droppedKey)
    const pairId = crypto.randomUUID()
    for (const item of group.items) {
      if (item.key === targetKey || item.key === droppedKey)
        item.pairId = pairId
    }
    persistLinearData()
  }

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
    // Remove replacement from its current position
    const repIdx = group.items.findIndex((i) => i.key === replacementKey)
    if (repIdx === -1) return
    const [moved] = group.items.splice(repIdx, 1)
    // Unpair the replacement from any existing pair
    if (moved.pairId) {
      for (const i of group.items) {
        if (i.pairId === moved.pairId) i.pairId = undefined
      }
    }
    // Insert replacement where target is and give it the target's pairId
    const targetIdx = group.items.findIndex((i) => i.key === targetKey)
    moved.pairId = pairId
    group.items.splice(targetIdx, 0, moved)
    // Remove target from pair and move it out
    targetItem.pairId = undefined
    persistLinearData()
  }

  function unpairItem(groupId: string, itemKey: string) {
    const group = findGroup(groupId)
    if (!group) return
    const item = group.items.find((i) => i.key === itemKey)
    if (!item?.pairId) return
    const pairId = item.pairId
    for (const i of group.items) {
      if (i.pairId === pairId) i.pairId = undefined
    }
    persistLinearData()
  }

  return {
    addItemToGroup,
    autoAssignInputs,
    createGroup,
    dissolveGroup,
    enterBuilder,
    exitBuilder,
    getGroupForItem,
    getInputColor,
    getZone,
    gridOverrides,
    hasNodes,
    hasOutputs,
    inputGroups,
    layoutTemplateId,
    moveGroupToZone,
    moveWidgetItem,
    getZoneItems,
    pairItemsInGroup,
    persistLinearData,
    pruneLinearData,
    removeItemFromGroup,
    renameGroup,
    reorderWithinGroup,
    setGroupColor,
    setInputColor,
    reorderZoneItem,
    resetSelectedToWorkflow,
    selectedInputs,
    selectedOutputs,
    runControlsZoneId,
    setGridOverrides,
    setRunControlsZone,
    setZone,
    switchTemplate,
    unpairItem,
    widgetOverrides,
    presets,
    presetsEnabled,
    presetDisplayMode,
    presetStripZoneId,
    setPresetStripZone,
    zoneAssignments
  }
})
