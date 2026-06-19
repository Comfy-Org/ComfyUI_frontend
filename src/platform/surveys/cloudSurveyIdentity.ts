import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTelemetry } from '@/platform/telemetry'

import { getOrCreateAnonId } from './surveyIdentity'
import type { IdentityProvider } from './surveyIdentity'

export const cloudIdentityProvider: IdentityProvider = {
  getIdentity() {
    const { resolvedUserInfo } = useCurrentUser()
    return {
      anon_id: getOrCreateAnonId(),
      distinct_id: useTelemetry()?.getDistinctId() ?? undefined,
      comfy_id: resolvedUserInfo.value?.id
    }
  }
}
