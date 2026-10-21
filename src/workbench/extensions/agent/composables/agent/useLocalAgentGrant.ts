import { readonly, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { useAuthStore } from '@/stores/authStore'

export type LocalAgentGrantArm = 'control' | 'treatment' | 'unknown'

export function useLocalAgentGrant(scope: MaybeRefOrGetter<string | null>) {
  const authStore = useAuthStore()
  const arm = ref<LocalAgentGrantArm>('unknown')

  async function readArm(signal: AbortSignal): Promise<LocalAgentGrantArm> {
    try {
      const headers = await authStore.getUserAuthHeader()
      if (!headers || signal.aborted) return 'unknown'

      const response = await fetch(`${getComfyCloudBaseUrl()}/api/features`, {
        headers,
        signal,
        cache: 'no-store',
        redirect: 'error'
      })
      if (!response.ok) return 'unknown'

      const features: unknown = await response.json()
      if (
        typeof features !== 'object' ||
        features === null ||
        !('agent_gratis_local_arm' in features)
      )
        return 'unknown'

      const assignment = features.agent_gratis_local_arm
      return assignment === 'control' || assignment === 'treatment'
        ? assignment
        : 'unknown'
    } catch {
      return 'unknown'
    }
  }

  watch(
    () => toValue(scope),
    (currentScope, _previousScope, onCleanup) => {
      arm.value = 'unknown'
      if (currentScope === null) return

      const controller = new AbortController()
      onCleanup(() => controller.abort())
      void readArm(controller.signal).then((assignment) => {
        if (!controller.signal.aborted) arm.value = assignment
      })
    },
    { immediate: true, flush: 'sync' }
  )

  return { arm: readonly(arm) }
}
