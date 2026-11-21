import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

import {
  getCoreEquivalent,
  getInstalledCoreEquivalent
} from './coreEquivalentAllowlist'
import { fetchNodeReplacements } from './nodeReplacementService'
import type { NodeReplacement, NodeReplacementResponse } from './types'

function isCoreTarget(type: string): boolean {
  const target = LiteGraph.registered_node_types[type]?.nodeData
  return target instanceof ComfyNodeDefImpl && target.isCoreNode
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

  function getReplacementFor(nodeType: string): NodeReplacement | null {
    if (!isEnabled.value) return null
    return replacements.value[nodeType]?.[0] ?? null
  }

  function hasReplacement(nodeType: string): boolean {
    if (!isEnabled.value) return false
    return !!replacements.value[nodeType]?.length
  }

  function getMissingNodeReplacement(
    node: Parameters<typeof getCoreEquivalent>[0]
  ) {
    if (!isEnabled.value) return null
    const server = getReplacementFor(node.type)
    if (server) return server
    const local = getCoreEquivalent(node)
    return local && local.new_node_id in LiteGraph.registered_node_types
      ? local
      : null
  }

  function getInstalledNodeReplacement(node: LGraphNode) {
    if (!isEnabled.value || !node.graph || node.last_serialization) return null
    const source = node.constructor.nodeData
    if (
      !(source instanceof ComfyNodeDefImpl) ||
      source.output_node ||
      source.output_is_list?.some(Boolean) ||
      node.constructor !== LiteGraph.registered_node_types[node.type]
    )
      return null
    const local = getInstalledCoreEquivalent(
      node.type,
      source.python_module,
      () => node.serialize()
    )
    if (!local) return null
    return isCoreTarget(local.new_node_id) ? local : null
  }

  return {
    replacements,
    isLoaded,
    isEnabled,
    load,
    getInstalledNodeReplacement,
    getMissingNodeReplacement,
    getReplacementFor,
    hasReplacement
  }
})
