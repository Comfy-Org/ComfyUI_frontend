import { defineStore } from 'pinia'
import { reactive, computed, ref, watch } from 'vue'

import { useEmptyWorkflowDialog } from '@/components/builder/useEmptyWorkflowDialog'
import { getTemplate } from '@/components/builder/layoutTemplates'
import type {
  GridOverride,
  LayoutTemplateId
} from '@/components/builder/layoutTemplates'
import { OUTPUT_ZONE_KEY } from '@/components/builder/useZoneWidgets'
import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LinearData } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { resolveNode } from '@/utils/litegraphUtil'

export function nodeTypeValidForApp(type: string) {
  return !['Note', 'MarkdownNote'].includes(type)
}

export const useAppModeStore = defineStore('appMode', () => {
  const { getCanvas } = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const { mode, setMode, isBuilderMode, isAppMode, isSelectMode } = useAppMode()
  const emptyWorkflowDialog = useEmptyWorkflowDialog()

  const selectedInputs = reactive<[NodeId, string][]>([])
  const selectedOutputs = reactive<NodeId[]>([])
  const layoutTemplateId = ref<LayoutTemplateId>('sidebar')
  const zoneAssignmentsPerTemplate = reactive<
    Record<string, Record<string, string>>
  >({})
  const gridOverridesPerTemplate = reactive<Record<string, GridOverride>>({})
  const runControlsZoneIdPerTemplate = reactive<Record<string, string>>({})
  /** Per-zone item order — unified list of item keys per zone, per template. */
  const zoneItemOrderPerTemplate = reactive<
    Record<string, Record<string, string[]>>
  >({})
  /** Per-zone stacking direction: 'top' (default) or 'bottom'. */
  const zoneAlignPerTemplate = reactive<
    Record<string, Record<string, 'top' | 'bottom'>>
  >({})

  const zoneAssignments = computed(
    () => zoneAssignmentsPerTemplate[layoutTemplateId.value] ?? {}
  )
  const gridOverrides = computed<GridOverride | undefined>(
    () => gridOverridesPerTemplate[layoutTemplateId.value]
  )
  const runControlsZoneId = computed(
    () => runControlsZoneIdPerTemplate[layoutTemplateId.value]
  )
  const zoneItemOrder = computed(
    () => zoneItemOrderPerTemplate[layoutTemplateId.value] ?? {}
  )
  const zoneAlign = computed(
    () => zoneAlignPerTemplate[layoutTemplateId.value] ?? {}
  )
  const hasOutputs = computed(() => !!selectedOutputs.length)
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

  /** O(n+m) computation of which zones should show outputs. */
  const outputZoneIds = computed(() => {
    const tmpl = getTemplate(layoutTemplateId.value)
    if (!tmpl) return new Set<string>()

    const explicitZones = new Set<string>()
    for (const nodeId of selectedOutputs) {
      const zone = getZone(nodeId, OUTPUT_ZONE_KEY)
      if (zone) explicitZones.add(zone)
    }

    if (explicitZones.size > 0) return explicitZones
    return new Set(tmpl.zones.filter((z) => z.isOutput).map((z) => z.id))
  })

  /** Assign unassigned inputs to the least-full input zone. Does NOT persist. */
  function autoAssignInputs() {
    const tmpl = getTemplate(layoutTemplateId.value)
    if (!tmpl) return
    const inputZones = tmpl.zones.filter((z) => !z.isOutput)
    if (inputZones.length === 0) return

    const assignments = ensureTemplateAssignments()
    for (const [nodeId, widgetName] of selectedInputs) {
      const key = zoneKey(nodeId, widgetName)
      if (assignments[key]) continue
      const counts = new Map<string, number>()
      for (const z of inputZones) counts.set(z.id, 0)
      for (const [nId, wName] of selectedInputs) {
        const assigned = assignments[zoneKey(nId, wName)]
        if (assigned && counts.has(assigned)) {
          counts.set(assigned, (counts.get(assigned) ?? 0) + 1)
        }
      }
      const leastFull = [...counts.entries()].sort((a, b) => a[1] - b[1])[0]
      if (leastFull) assignments[key] = leastFull[0]
    }
  }

  /** Switch to a new template, redistributing inputs/outputs for the new layout. */
  function switchTemplate(newId: LayoutTemplateId) {
    layoutTemplateId.value = newId
    const tmpl = getTemplate(newId)
    if (!tmpl) return

    const assignments = ensureTemplateAssignments()
    const validZoneIds = new Set(tmpl.zones.map((z) => z.id))

    // Clear stale zone assignments for this template
    for (const key of Object.keys(assignments)) {
      if (!validZoneIds.has(assignments[key])) {
        delete assignments[key]
      }
    }

    // Re-assign unassigned outputs to default output zones
    const defaultOutputZone = tmpl.zones.find((z) => z.isOutput)
    if (defaultOutputZone) {
      for (const nodeId of selectedOutputs) {
        const key = zoneKey(nodeId, OUTPUT_ZONE_KEY)
        if (!assignments[key] || !validZoneIds.has(assignments[key])) {
          assignments[key] = defaultOutputZone.id
        }
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
      zoneItemOrderPerTemplate: data?.zoneItemOrderPerTemplate,
      zoneAlignPerTemplate: data?.zoneAlignPerTemplate
    }
  }

  function loadSelections(data: Partial<LinearData> | undefined) {
    const pruned = pruneLinearData(data)
    selectedInputs.splice(0, selectedInputs.length, ...pruned.inputs)
    selectedOutputs.splice(0, selectedOutputs.length, ...pruned.outputs)
    const VALID_TEMPLATE_IDS: Set<string> = new Set([
      'focus',
      'grid',
      'sidebar'
    ])
    layoutTemplateId.value = VALID_TEMPLATE_IDS.has(
      pruned.layoutTemplateId ?? ''
    )
      ? (pruned.layoutTemplateId as LayoutTemplateId)
      : 'sidebar'
    Object.keys(zoneAssignmentsPerTemplate).forEach(
      (k) => delete zoneAssignmentsPerTemplate[k]
    )
    Object.assign(
      zoneAssignmentsPerTemplate,
      pruned.zoneAssignmentsPerTemplate ?? {}
    )
    Object.keys(gridOverridesPerTemplate).forEach(
      (k) => delete gridOverridesPerTemplate[k]
    )
    Object.assign(
      gridOverridesPerTemplate,
      pruned.gridOverridesPerTemplate ?? {}
    )
    Object.keys(runControlsZoneIdPerTemplate).forEach(
      (k) => delete runControlsZoneIdPerTemplate[k]
    )
    Object.assign(
      runControlsZoneIdPerTemplate,
      pruned.runControlsZoneIdPerTemplate ?? {}
    )
    Object.keys(zoneItemOrderPerTemplate).forEach(
      (k) => delete zoneItemOrderPerTemplate[k]
    )
    Object.assign(
      zoneItemOrderPerTemplate,
      pruned.zoneItemOrderPerTemplate ?? {}
    )
    Object.keys(zoneAlignPerTemplate).forEach(
      (k) => delete zoneAlignPerTemplate[k]
    )
    Object.assign(zoneAlignPerTemplate, pruned.zoneAlignPerTemplate ?? {})
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
      inputs: [...selectedInputs],
      outputs: [...selectedOutputs],
      layoutTemplateId: layoutTemplateId.value,
      zoneAssignmentsPerTemplate: JSON.parse(
        JSON.stringify(zoneAssignmentsPerTemplate)
      ),
      gridOverridesPerTemplate: JSON.parse(
        JSON.stringify(gridOverridesPerTemplate)
      ),
      runControlsZoneIdPerTemplate: { ...runControlsZoneIdPerTemplate },
      zoneItemOrderPerTemplate: JSON.parse(
        JSON.stringify(zoneItemOrderPerTemplate)
      ),
      zoneAlignPerTemplate: JSON.parse(JSON.stringify(zoneAlignPerTemplate))
    }
  }

  watch(
    () =>
      isBuilderMode.value
        ? { inputs: [...selectedInputs], outputs: [...selectedOutputs] }
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
    hasRunControls: boolean
  ): string[] {
    const existing = zoneItemOrder.value[zoneId]
    if (existing && existing.length > 0) {
      // Filter out stale keys that no longer exist, append new ones
      const validKeys = new Set<string>()
      for (const o of outputs) validKeys.add(`output:${o.nodeId}`)
      for (const w of widgets)
        validKeys.add(`input:${w.nodeId}:${w.widgetName}`)
      if (hasRunControls) validKeys.add('run-controls')

      const kept = existing.filter((k) => validKeys.has(k))
      const keptSet = new Set(kept)
      for (const k of validKeys) {
        if (!keptSet.has(k)) kept.push(k)
      }
      return kept
    }
    // Default order: outputs, inputs, run controls
    const keys: string[] = []
    for (const o of outputs) keys.push(`output:${o.nodeId}`)
    for (const w of widgets) keys.push(`input:${w.nodeId}:${w.widgetName}`)
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

  function toggleZoneAlign(zoneId: string) {
    const tid = layoutTemplateId.value
    if (!zoneAlignPerTemplate[tid]) zoneAlignPerTemplate[tid] = {}
    const current = zoneAlignPerTemplate[tid][zoneId] ?? 'top'
    zoneAlignPerTemplate[tid][zoneId] = current === 'top' ? 'bottom' : 'top'
    persistLinearData()
  }

  return {
    autoAssignInputs,
    enterBuilder,
    exitBuilder,
    getZone,
    gridOverrides,
    hasNodes,
    hasOutputs,
    layoutTemplateId,
    getZoneItems,
    outputZoneIds,
    pruneLinearData,
    reorderZoneItem,
    resetSelectedToWorkflow,
    selectedInputs,
    selectedOutputs,
    runControlsZoneId,
    setGridOverrides,
    setRunControlsZone,
    setZone,
    switchTemplate,
    toggleZoneAlign,
    zoneAlign,
    zoneAssignments
  }
})
