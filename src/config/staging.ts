import { computed } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const BUILD_TIME_IS_STAGING = !__USE_PROD_CONFIG__

/**
 * Returns whether the current environment is staging.
 * - Cloud builds use runtime configuration (firebase_config.projectId containing '-dev')
 * - OSS / localhost builds fall back to the build-time config determined by __USE_PROD_CONFIG__
 */
export const isStaging = computed(() => {
  if (!isCloud) {
    return BUILD_TIME_IS_STAGING
  }

  const projectId = remoteConfig.value.firebase_config?.projectId
  return projectId?.includes('-dev') ?? BUILD_TIME_IS_STAGING
})
