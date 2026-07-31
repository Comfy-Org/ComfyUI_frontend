import { watch } from 'vue'

import { useFeatureGate } from '@/composables/useFeatureGate'
import { api } from '@/scripts/api'
import { useExtensionService } from '@/services/extensionService'

const flagKey = 'fastlane_feature_flag_foo'

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.FastLaneFeatureFlagDemo',

  setup: () => {
    const { state, value: enabled, recordExposure } = useFeatureGate(flagKey)

    watch(
      [state, enabled],
      ([state, isEnabled]) => {
        if (state !== 'resolved' && state !== 'error') return

        recordExposure()
        if (!isEnabled) return

        void api.fetchApi('/fastlane-demo').catch((error: unknown) => {
          console.warn('Fast Lane demo server gate rejected:', error)
        })
      },
      { immediate: true }
    )
  }
})
