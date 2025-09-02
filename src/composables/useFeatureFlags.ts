import { computed, readonly } from 'vue'

import { useFeatureFlagsStore } from '@/stores/featureFlagsStore'

/**
 * Known server feature flags
 */
export enum ServerFeatureFlag {
  // Core features
  SUPPORTS_PREVIEW_METADATA = 'supports_preview_metadata',
  MAX_UPLOAD_SIZE = 'max_upload_size',

  // Extension features
  MANAGER_SUPPORTS_V4 = 'extension.manager.supports_v4'
}

/**
 * Known client feature flags
 */
export enum ClientFeatureFlag {
  SUPPORTS_MANAGER_V4_UI = 'supports_manager_v4_ui'
}

/**
 * Composable for reactive access to feature flags
 */
export function useFeatureFlags() {
  const featureFlagsStore = useFeatureFlagsStore()

  // Expose commonly used flags directly as computed properties
  const flags = computed(() => ({
    // Server flags
    supportsPreviewMetadata: featureFlagsStore.getServerFeature<boolean>(
      ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA,
      false
    ),
    maxUploadSize: featureFlagsStore.getServerFeature<number>(
      ServerFeatureFlag.MAX_UPLOAD_SIZE
    ),
    supportsManagerV4: featureFlagsStore.supportsManagerV4,

    // Client flags
    clientSupportsManagerV4UI: featureFlagsStore.clientSupportsManagerV4UI,

    // Store ready state
    isReady: featureFlagsStore.isReady
  }))

  // Create a reactive computed for any feature flag
  const featureFlag = <T = unknown>(featurePath: string, defaultValue?: T) => {
    return computed(() =>
      featureFlagsStore.getServerFeature(featurePath, defaultValue)
    )
  }

  // Create a reactive computed for checking if server supports a feature
  const serverSupportsFeature = (featurePath: string) => {
    return computed(() => featureFlagsStore.serverSupportsFeature(featurePath))
  }

  return {
    // Enums for type-safe access
    ServerFeatureFlag,
    ClientFeatureFlag,

    // Computed flags object
    flags: readonly(flags),

    // Helper functions
    featureFlag,
    serverSupportsFeature,

    // Direct access to store methods (for advanced usage)
    getServerFeature: featureFlagsStore.getServerFeature,
    getClientFeature: featureFlagsStore.getClientFeature
  }
}
