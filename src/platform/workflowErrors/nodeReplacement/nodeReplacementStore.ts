import type { NodeReplacement, NodeReplacementResponse } from './types'

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { extractCustomNodeName } from '@/platform/customNodes/manager/utils/packUtils'
import type { FlattenableWorkflowNode } from '@/platform/workflow/core/utils/workflowFlattening'
import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { fetchNodeReplacements } from './nodeReplacementService'

/** A missing node's saved widgets: workflow `widgets_values`, or an API prompt's named inputs. */
export type SavedWidgets =
  | { widgetsValues: FlattenableWorkflowNode['widgets_values'] }
  | { apiInputs: Record<string, unknown> }

const API_OMITTED_WIDGET_IDS = new Set([
  'control_after_generate',
  'control_filter_list'
])

function fitsSavedWidgets(
  entry: NodeReplacement,
  saved: SavedWidgets
): boolean {
  const widgetIds = entry.old_widget_ids ?? []
  if ('apiInputs' in saved) {
    const inputs = Object.entries(saved.apiInputs)
    const names = new Set(inputs.map(([name]) => name))
    return (
      widgetIds.every(
        (id) => API_OMITTED_WIDGET_IDS.has(id) || names.has(id)
      ) &&
      inputs.every(
        ([name, value]) => Array.isArray(value) || widgetIds.includes(name)
      )
    )
  }
  const values = saved.widgetsValues ?? []
  return Array.isArray(values) && values.length === widgetIds.length
}

export const useNodeReplacementStore = defineStore('nodeReplacement', () => {
  const settingStore = useSettingStore()
  const replacements = ref<NodeReplacementResponse>({})
  const isLoaded = ref(false)
  const isEnabled = computed(() =>
    settingStore.get('Comfy.NodeReplacement.Enabled')
  )

  async function load() {
    if (!isEnabled.value || isLoaded.value) return
    if (!hasNodeReplacementFeature()) return

    try {
      replacements.value = await fetchNodeReplacements()
      isLoaded.value = true
    } catch (error) {
      console.error('Failed to load node replacements:', error)
    }
  }

  function hasNodeReplacementFeature(): boolean {
    return api.getServerFeature(ServerFeatureFlag.NODE_REPLACEMENTS, false)
  }

  function entriesFor(nodeType: string): NodeReplacement[] {
    if (!isEnabled.value) return []
    return replacements.value[nodeType] ?? []
  }

  function matchPack(
    entries: NodeReplacement[],
    pack: string | undefined
  ): NodeReplacement | undefined {
    return (
      entries.find(
        (entry) =>
          entry.old_pack != null && entry.old_pack.toLowerCase() === pack
      ) ?? entries.find((entry) => entry.old_pack == null)
    )
  }

  /** Replacement for a registered node type; pack entries apply only when its definition comes from that pack. */
  function getReplacementForInstalled(
    nodeType: string,
    pythonModule: string | undefined
  ): NodeReplacement | null {
    const pack = extractCustomNodeName(pythonModule)?.toLowerCase()
    return matchPack(entriesFor(nodeType), pack) ?? null
  }

  /** Replacement for an unregistered node type, matched by the pack the workflow saved it from. */
  function getReplacementForMissing(
    nodeType: string,
    cnrId: string | undefined,
    saved: SavedWidgets
  ): NodeReplacement | null {
    const entries = entriesFor(nodeType)
    const match = matchPack(entries, cnrId?.toLowerCase())
    if (match) return match
    const [first] = entries
    const fitsOnlyPack =
      cnrId === undefined &&
      entries.length > 0 &&
      entries.every(
        (entry) =>
          entry.old_pack?.toLowerCase() === first.old_pack?.toLowerCase()
      ) &&
      fitsSavedWidgets(first, saved)
    return fitsOnlyPack ? first : null
  }

  function hasReplacement(nodeType: string): boolean {
    if (!isEnabled.value) return false
    return !!replacements.value[nodeType]?.length
  }

  return {
    replacements,
    isLoaded,
    isEnabled,
    load,
    getReplacementForInstalled,
    getReplacementForMissing,
    hasReplacement
  }
})
