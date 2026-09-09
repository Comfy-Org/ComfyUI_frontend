import { onMounted, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { isInChina } from '@comfyorg/shared-frontend-utils/networkUtil'

export type RegionGateStatus = 'pending' | 'blocked' | 'allowed'

/**
 * Gates email sign-up on the client's region. Starts `pending` and always
 * leaves it. Do not race this against a timeout: that decides `allowed` while a
 * real `blocked` answer is still in flight. The probe runs once, when the
 * component has mounted and `enabled` is true, so a host that gates its
 * sign-up form behind a flag never probes for a page it does not show.
 */
export function useRegionGate(enabled: Readonly<Ref<boolean>> = ref(true)): {
  status: Readonly<Ref<RegionGateStatus>>
} {
  const status = ref<RegionGateStatus>('pending')
  let probed = false

  onMounted(() => {
    watch(
      enabled,
      async (on) => {
        if (!on || probed) return
        probed = true
        status.value = (await isInChina().catch(() => false))
          ? 'blocked'
          : 'allowed'
      },
      { immediate: true }
    )
  })

  return { status: readonly(status) }
}
