import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  clearCloudBillingFlags,
  refreshCloudBillingFlags
} from '@/platform/remoteConfig/cloudBillingFlags'
import type { ComfyExtension } from '@/types/comfy'

export const localCloudBillingFlagsExtension: ComfyExtension = {
  name: 'Comfy.Local.CloudBillingFlags',

  setup: () => {
    const { resolvedUserInfo } = useCurrentUser()
    watch(
      () => resolvedUserInfo.value?.id,
      (userId) => {
        if (userId) void refreshCloudBillingFlags()
        else clearCloudBillingFlags()
      },
      { immediate: true }
    )
  }
}
