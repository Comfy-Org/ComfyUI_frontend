import { createSharedComposable } from '@vueuse/core'
import { computed } from 'vue'

import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

function useAccountUIInternal() {
  const workspace = useWorkspaceUI()
  const billing = useBillingUI()

  return {
    ...workspace,
    ...billing,
    permissions: computed(() => ({
      ...workspace.permissions.value,
      ...billing.permissions.value
    }))
  }
}

export const useAccountUI = createSharedComposable(useAccountUIInternal)
