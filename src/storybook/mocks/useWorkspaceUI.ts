import { computed, ref } from 'vue'

import type { WorkspaceType } from '@/platform/workspace/api/workspaceApi'

/** The workspace role/permission state a story wants the stub to report. */
export interface WorkspaceUIMockState {
  workspaceType: WorkspaceType
  canManageSubscription: boolean
  canManageSubscriptionLifecycle: boolean
  canTopUp: boolean
}

const defaultState: WorkspaceUIMockState = {
  workspaceType: 'team',
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canTopUp: true
}

const state = ref<WorkspaceUIMockState>({ ...defaultState })

/** Drives the stub from a story's `beforeEach`. */
export function setWorkspaceUIMock(next: Partial<WorkspaceUIMockState>) {
  state.value = { ...defaultState, ...next }
}

/**
 * Storybook mock for `useWorkspaceUI`.
 *
 * The real composable derives permissions from `useCurrentUser` (Firebase auth)
 * and the team workspace store, neither of which is available in Storybook. This
 * stub exposes only the role surface the billing banner reads; add keys here as
 * other stories need them.
 */
export function useWorkspaceUI() {
  return {
    workspaceType: computed(() => state.value.workspaceType),
    permissions: computed(() => ({
      canManageSubscription: state.value.canManageSubscription,
      canManageSubscriptionLifecycle:
        state.value.canManageSubscriptionLifecycle,
      canTopUp: state.value.canTopUp
    }))
  }
}
