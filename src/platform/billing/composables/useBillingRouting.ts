import { computed } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'

import type { BillingType } from './types'

export function useBillingRouting() {
  const workspaceStore = useWorkspaceIdentity()

  const shouldUseUnifiedPricing = computed(() => {
    return isCloud && workspaceStore.activeWorkspace?.type !== undefined
  })

  const type = computed<BillingType>(() => {
    const workspaceType = workspaceStore.activeWorkspace?.type
    if (!workspaceType) return 'unknown'

    return 'workspace'
  })

  const shouldUseWorkspaceBilling = computed(() => type.value === 'workspace')

  return { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing }
}
