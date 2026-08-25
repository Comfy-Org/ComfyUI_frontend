import { onMounted, readonly, ref } from 'vue'

import { isInChina } from '@/utils/networkUtil'

export type RegionGateStatus = 'pending' | 'blocked' | 'allowed'

/**
 * Gates email sign-up on the client's region. Starts `pending` and always
 * leaves it. Do not race this against a timeout: that decides `allowed` while a
 * real `blocked` answer is still in flight.
 */
export function useRegionGate() {
  const status = ref<RegionGateStatus>('pending')

  onMounted(async () => {
    status.value = (await isInChina().catch(() => false))
      ? 'blocked'
      : 'allowed'
  })

  return { status: readonly(status) }
}
