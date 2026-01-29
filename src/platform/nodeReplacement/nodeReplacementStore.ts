import type { NodeReplacement, NodeReplacementResponse } from './types'

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { fetchNodeReplacements } from './services/nodeReplacementService'

export const useNodeReplacementStore = defineStore('nodeReplacement', () => {
  const replacements = ref<NodeReplacementResponse>({})
  const isLoaded = ref(false)

  async function load() {
    if (isLoaded.value) return

    try {
      replacements.value = await fetchNodeReplacements()
      isLoaded.value = true
    } catch (error) {
      console.error('Failed to load node replacements:', error)
    }
  }

  function isEnabled(): boolean {
    return useSettingStore().get('Comfy.NodeReplacement.Enabled')
  }

  function getReplacementFor(nodeType: string): NodeReplacement | null {
    if (!isEnabled()) return null
    return replacements.value[nodeType]?.[0] ?? null
  }

  function hasReplacement(nodeType: string): boolean {
    if (!isEnabled()) return false
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
