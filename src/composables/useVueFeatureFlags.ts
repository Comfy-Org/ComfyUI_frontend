/**
 * Vue-related feature flags composable
 * Manages local settings-driven flags and LiteGraph integration
 */
import { computed, watch } from 'vue'

import { useSettingStore } from '@/stores/settingStore'

import { LiteGraph } from '../lib/litegraph/src/litegraph'

export const useVueFeatureFlags = () => {
  const settingStore = useSettingStore()

  // Enable Vue-based node rendering (off by default unless explicitly enabled)
  const isVueNodesEnabled = computed(() => {
    try {
      return settingStore.get('Comfy.VueNodes.Enabled') ?? false
    } catch {
      return false
    }
  })

  // Development mode features (debug panel, etc.)
  const isDevModeEnabled = computed(() => {
    try {
      return (
        (settingStore.get('Comfy.DevMode' as any) as boolean | undefined) ??
        process.env.NODE_ENV === 'development'
      )
    } catch {
      return process.env.NODE_ENV === 'development'
    }
  })

  // Whether Vue nodes should render
  const shouldRenderVueNodes = computed(
    () => isVueNodesEnabled.value && true // hook for additional safety checks
  )

  // Sync the Vue nodes flag with LiteGraph global settings
  const syncVueNodesFlag = () => {
    LiteGraph.vueNodesMode = isVueNodesEnabled.value
    console.log('Vue nodes mode:', LiteGraph.vueNodesMode)
  }

  // Watch for changes and update LiteGraph immediately
  watch(isVueNodesEnabled, syncVueNodesFlag, { immediate: true })

  return {
    isVueNodesEnabled,
    isDevModeEnabled,
    shouldRenderVueNodes,
    syncVueNodesFlag
  }
}
