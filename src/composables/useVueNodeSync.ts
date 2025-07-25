/**
 * Syncs Vue node feature flag with LiteGraph global settings
 *
 * Usage in GraphCanvas.vue:
 * ```typescript
 * import { useVueNodeSync } from '@/composables/useVueNodeSync'
 *
 * // In the setup function or onMounted
 * onMounted(() => {
 *   useVueNodeSync()
 *   // ... rest of initialization
 * })
 * ```
 */
import { LiteGraph } from '@comfyorg/litegraph'
import { watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'

export const useVueNodeSync = () => {
  const { isVueNodesEnabled } = useFeatureFlags()

  // Sync the feature flag with LiteGraph on changes
  const syncFeatureFlag = () => {
    LiteGraph.vueNodesMode = isVueNodesEnabled.value
    console.log('Vue nodes mode:', LiteGraph.vueNodesMode)
  }

  // Watch for changes and update LiteGraph
  watch(isVueNodesEnabled, syncFeatureFlag, { immediate: true })

  return {
    syncFeatureFlag
  }
}
