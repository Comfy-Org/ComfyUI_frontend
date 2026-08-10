import { onMounted, readonly, ref } from 'vue'

import { isInChina } from '@/utils/networkUtil'

export type RegionGateStatus = 'pending' | 'blocked' | 'allowed'

/**
 * Gates email sign-up on the client's region.
 *
 * Starts `pending` so a caller cannot render the form before the region is
 * known, and always leaves that state: detection bounds itself, and any
 * rejection resolves to `allowed`. Callers must not race this against a timeout
 * of their own — that would decide `allowed` while a real `blocked` answer is
 * still in flight.
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
