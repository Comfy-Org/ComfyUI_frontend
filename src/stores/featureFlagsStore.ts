import { get } from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import { computed, nextTick, ref } from 'vue'

/**
 * Store for managing server and client feature flags reactively
 */
export const useFeatureFlagsStore = defineStore('featureFlags', () => {
  // Server feature flags received from WebSocket
  const serverFlags = ref<Record<string, unknown>>({})

  // Client feature flags (local)
  const clientFlags = ref<Record<string, unknown>>({})

  // Flag to indicate if the store has received initial server flags
  const isReady = ref(false)

  // Track update version to prevent race conditions
  let updateVersion = 0

  /**
   * Update server feature flags
   * Called when WebSocket receives feature_flags message
   */
  function updateServerFlags(flags: Record<string, unknown>) {
    // Validate input
    if (!flags || typeof flags !== 'object') {
      console.error('[FeatureFlags] Invalid flags received:', flags)
      return
    }

    // Increment version for this update
    const currentVersion = ++updateVersion

    // Use nextTick to batch updates and check version
    void nextTick(() => {
      // Only apply if this is still the latest update
      if (currentVersion === updateVersion) {
        serverFlags.value = { ...flags }
        isReady.value = true
        console.log('[FeatureFlags] Server flags updated:', serverFlags.value)
      } else {
        console.log(
          '[FeatureFlags] Skipping outdated update, version:',
          currentVersion
        )
      }
    })
  }

  /**
   * Update client feature flags
   */
  function updateClientFlags(flags: Record<string, unknown>) {
    clientFlags.value = { ...flags }
    console.log('[FeatureFlags] Client flags updated:', clientFlags.value)
  }

  /**
   * Get a server feature flag value (reactive)
   */
  function getServerFeature<T = unknown>(
    featurePath: string,
    defaultValue?: T
  ): T {
    return get(serverFlags.value, featurePath, defaultValue) as T
  }

  /**
   * Check if server supports a feature (reactive)
   */
  function serverSupportsFeature(featurePath: string): boolean {
    return get(serverFlags.value, featurePath) === true
  }

  /**
   * Get a client feature flag value (reactive)
   */
  function getClientFeature<T = unknown>(
    featurePath: string,
    defaultValue?: T
  ): T {
    return get(clientFlags.value, featurePath, defaultValue) as T
  }

  /**
   * Computed property for manager v4 support
   */
  const supportsManagerV4 = computed<boolean>(() => {
    return (
      getServerFeature<boolean>('extension.manager.supports_v4', false) === true
    )
  })

  /**
   * Computed property for client manager v4 UI support
   */
  const clientSupportsManagerV4UI = computed<boolean>(() => {
    return getClientFeature<boolean>('supports_manager_v4_ui', false) === true
  })

  /**
   * Reset store state (useful for reconnection)
   */
  function resetStore() {
    console.log('[FeatureFlags] Resetting store state')
    serverFlags.value = {}
    isReady.value = false
    // Note: We don't reset clientFlags as they're local
    // Increment version to invalidate any pending updates
    updateVersion++
  }

  /**
   * Cleanup store (for unmounting or preventing memory leaks)
   */
  function cleanup() {
    console.log('[FeatureFlags] Cleaning up store')
    resetStore()
    clientFlags.value = {}
    // Cancel any pending nextTick callbacks by incrementing version
    updateVersion = Number.MAX_SAFE_INTEGER
  }

  return {
    serverFlags,
    clientFlags,
    isReady,
    updateServerFlags,
    updateClientFlags,
    getServerFeature,
    serverSupportsFeature,
    getClientFeature,
    supportsManagerV4,
    clientSupportsManagerV4UI,
    resetStore,
    cleanup
  }
})
