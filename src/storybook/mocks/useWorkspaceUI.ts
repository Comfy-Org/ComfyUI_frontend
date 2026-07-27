import { computed, ref } from 'vue'

import type { WorkspaceType } from '@/platform/workspace/api/workspaceApi'

/** The workspace role/permission state a story wants the stub to report. */
export interface WorkspaceUIMockState {
  workspaceType: WorkspaceType
  canManageSubscription: boolean
  canManageSubscriptionLifecycle: boolean
  canDowngradeToPersonal: boolean
  canTopUp: boolean
  isSubscriptionCancelled: boolean
}

const defaultState: WorkspaceUIMockState = {
  workspaceType: 'team',
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canDowngradeToPersonal: true,
  canTopUp: true,
  isSubscriptionCancelled: false
}

const state = ref<WorkspaceUIMockState>({ ...defaultState })

/** Drives the stub from a story's `beforeEach`. */
export function setWorkspaceUIMock(next: Partial<WorkspaceUIMockState>) {
  state.value = { ...defaultState, ...next }
}

/** Storybook mock for `useWorkspaceUI`. */
export function useWorkspaceUI() {
  return {
    workspaceType: computed(() => state.value.workspaceType),
    permissions: computed(() => ({
      canManageSubscription: state.value.canManageSubscription,
      canManageSubscriptionLifecycle:
        state.value.canManageSubscriptionLifecycle,
      canDowngradeToPersonal: state.value.canDowngradeToPersonal,
      canTopUp: state.value.canTopUp
    })),
    isSubscriptionCancelled: computed(() => state.value.isSubscriptionCancelled)
  }
}
