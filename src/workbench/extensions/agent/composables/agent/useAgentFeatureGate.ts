import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import {
  ServerFeatureFlag,
  useFeatureFlags
} from '@/composables/useFeatureFlags'

export function useAgentFeatureGate(): ComputedRef<boolean> {
  const flag = useFeatureFlags().featureFlag(
    ServerFeatureFlag.AGENT_IN_APP_EXPERIENCE,
    false
  )
  return computed(() => flag.value === true)
}
