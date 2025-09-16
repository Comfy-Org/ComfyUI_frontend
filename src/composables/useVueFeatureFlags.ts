/**
 * Vue-related feature flags composable
 * Manages local settings-driven flags and LiteGraph integration
 */
import { computed, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

import { LiteGraph } from '../lib/litegraph/src/litegraph'

export const useVueFeatureFlags = () => {
  const settingStore = useSettingStore()

  const isVueNodesEnabled = computed(() => {
    try {
      return settingStore.get('Comfy.VueNodes.Enabled') ?? false
    } catch {
      return false
    }
  })

  // Whether Vue nodes should render
  const shouldRenderVueNodes = computed(() => isVueNodesEnabled.value)

  // Sync the Vue nodes flag with LiteGraph global settings
  const syncVueNodesFlag = () => {
    LiteGraph.vueNodesMode = isVueNodesEnabled.value
  }

  // Watch for changes and update LiteGraph immediately
  watch(isVueNodesEnabled, syncVueNodesFlag, { immediate: true })

  return {
    isVueNodesEnabled,
    shouldRenderVueNodes,
    syncVueNodesFlag
  }
}
