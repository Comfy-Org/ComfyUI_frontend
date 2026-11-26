import { computed, ref } from 'vue'

import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import type {
  WorkspaceRole,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'

export interface WorkspaceUIMockState {
  workspaceType: WorkspaceType
  workspaceRole: WorkspaceRole
  canManageSubscription: boolean
  canManageSubscriptionLifecycle: boolean
  canDowngradeToPersonal: boolean
  isSubscriptionCancelled: boolean
  canReactivatePlan: boolean
}

const defaultState: WorkspaceUIMockState = {
  workspaceType: 'team',
  workspaceRole: 'owner',
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canDowngradeToPersonal: true,
  isSubscriptionCancelled: false,
  canReactivatePlan: true
}

const state = ref<WorkspaceUIMockState>({ ...defaultState })

export function setWorkspaceUIMock(next: Partial<WorkspaceUIMockState>) {
  state.value = { ...defaultState, ...next }
}

export function useBillingUI() {
  return {
    workspaceType: computed(() => state.value.workspaceType),
    workspaceRole: computed(() => state.value.workspaceRole),
    permissions: computed(() => ({
      canManageSubscription: receiveServerFact(
        'can_manage_subscription',
        state.value.canManageSubscription
      ),
      canManageSubscriptionLifecycle: receiveServerFact(
        'can_manage_subscription',
        state.value.canManageSubscriptionLifecycle
      ),
      canDowngradeToPersonal: state.value.canDowngradeToPersonal
    })),
    isSubscriptionCancelled: computed(
      () => state.value.isSubscriptionCancelled
    ),
    canReactivatePlan: computed(() => state.value.canReactivatePlan)
  }
}
