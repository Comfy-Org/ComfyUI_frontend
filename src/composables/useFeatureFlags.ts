/**
 * Feature flags composable for Vue node system
 * Provides safe toggles for experimental features
 */
import { computed } from 'vue'

import { useSettingStore } from '@/stores/settingStore'

export const useFeatureFlags = () => {
  const settingStore = useSettingStore()

  /**
   * Enable Vue-based node rendering
   * When disabled, falls back to standard LiteGraph canvas rendering
   */
  const isVueNodesEnabled = computed(() => {
    try {
      return settingStore.get('Comfy.VueNodes.Enabled' as any) ?? true // Default to true for development
    } catch {
      return true // Default to true for development
    }
  })

  /**
   * Enable Vue widget rendering within Vue nodes
   * When disabled, Vue nodes render without widgets (structure only)
   */
  const isVueWidgetsEnabled = computed(() => {
    try {
      return settingStore.get('Comfy.VueNodes.Widgets' as any) ?? true
    } catch {
      return true
    }
  })

  /**
   * Enable viewport culling for performance
   * When disabled, all Vue nodes render regardless of viewport
   */
  const isViewportCullingEnabled = computed(() => {
    try {
      return settingStore.get('Comfy.VueNodes.ViewportCulling' as any) ?? true
    } catch {
      return true
    }
  })

  /**
   * Development mode features (debug panel, etc.)
   * Automatically enabled in development builds
   */
  const isDevModeEnabled = computed(() => {
    try {
      return (
        settingStore.get('Comfy.DevMode' as any) ??
        process.env.NODE_ENV === 'development'
      )
    } catch {
      return process.env.NODE_ENV === 'development'
    }
  })

  /**
   * Check if Vue nodes should be rendered at all
   * Combines multiple conditions for safety
   */
  const shouldRenderVueNodes = computed(
    () =>
      isVueNodesEnabled.value &&
      // Add any other safety conditions here
      true
  )

  /**
   * Get culling margin setting
   */
  const cullingMargin = computed(() => {
    try {
      return settingStore.get('Comfy.VueNodes.CullingMargin' as any) ?? 0.2
    } catch {
      return 0.2
    }
  })

  return {
    isVueNodesEnabled,
    isVueWidgetsEnabled,
    isViewportCullingEnabled,
    isDevModeEnabled,
    shouldRenderVueNodes,
    cullingMargin
  }
}
