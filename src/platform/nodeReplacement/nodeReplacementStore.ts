import type { NodeReplacement, NodeReplacementResponse } from './types'

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api } from '@/scripts/api'
import { useSettingStore } from '@/platform/settings/settingStore'
import { fetchNodeReplacements } from './nodeReplacementService'

export const useNodeReplacementStore = defineStore('nodeReplacement', () => {
  const settingStore = useSettingStore()
  const replacements = ref<NodeReplacementResponse>({})
  const isLoaded = ref(false)
  const isEnabled = computed(() =>
    settingStore.get('Comfy.NodeReplacement.Enabled')
  )

  async function load() {
    if (!isEnabled.value || isLoaded.value) return
    if (!api.serverSupportsFeature('node_replacements')) return

    try {
      replacements.value = await fetchNodeReplacements()
      isLoaded.value = true
    } catch (error) {
      console.error('Failed to load node replacements:', error)
    }
  }

  function getReplacementFor(nodeType: string): NodeReplacement | null {
    if (!isEnabled.value) return null
    return replacements.value[nodeType]?.[0] ?? null
  }

  function hasReplacement(nodeType: string): boolean {
    if (!isEnabled.value) return false
    return !!replacements.value[nodeType]?.length
  }

  return {
    replacements,
    isLoaded,
    load,
    isEnabled,
    getReplacementFor,
    hasReplacement
  }
})
