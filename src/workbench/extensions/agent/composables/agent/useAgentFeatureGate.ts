import type { ComputedRef } from 'vue'

import {
  ServerFeatureFlag,
  useFeatureFlags
} from '@/composables/useFeatureFlags'

export function useAgentFeatureGate(): ComputedRef<boolean> {
  return useFeatureFlags().featureFlag(
    ServerFeatureFlag.AGENT_IN_APP_EXPERIENCE,
    false
  )
}
