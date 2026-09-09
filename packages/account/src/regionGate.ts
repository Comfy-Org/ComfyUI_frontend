import { onMounted, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { isInChina } from '@comfyorg/shared-frontend-utils/networkUtil'

export type RegionGateStatus = 'pending' | 'blocked' | 'allowed'

/**
 * Gates email sign-up on the client's region. Starts `pending` and always
 * leaves it. Do not race this against a timeout: that decides `allowed` while a
 * real `blocked` answer is still in flight. The probe runs when the
 * component has mounted and `enabled` is true, so a host that gates its
 * sign-up form behind a flag never probes for a page it does not show;
 * disabling returns to `pending` and re-enabling probes again.
 */
export function useRegionGate(enabled: Readonly<Ref<boolean>> = ref(true)): {
  status: Readonly<Ref<RegionGateStatus>>
} {
  const status = ref<RegionGateStatus>('pending')
  // Bumped on every enabled change; a probe publishes only for the
  // generation that started it, so a result landing after a disable (or
  // before a re-enable) cannot leave a stale answer behind.
  let generation = 0

  onMounted(() => {
    watch(
      enabled,
      async (on) => {
        const probeGeneration = ++generation
        if (!on) {
          status.value = 'pending'
          return
        }
        const blocked = await isInChina().catch(() => false)
        if (probeGeneration !== generation) return
        status.value = blocked ? 'blocked' : 'allowed'
      },
      { immediate: true }
    )
  })

  return { status: readonly(status) }
}
