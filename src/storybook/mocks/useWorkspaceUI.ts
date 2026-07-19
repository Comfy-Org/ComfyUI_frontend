import { computed, ref } from 'vue'

import type { WorkspaceType } from '@/platform/workspace/api/workspaceApi'

/** The workspace role/permission state a story wants the stub to report. */
export interface WorkspaceUIMockState {
  workspaceType: WorkspaceType
  canManageSubscription: boolean
  canTopUp: boolean
}

const defaultState: WorkspaceUIMockState = {
  workspaceType: 'team',
  canManageSubscription: true,
  canTopUp: true
}

const state = ref<WorkspaceUIMockState>({ ...defaultState })

/** Drives the stub from a story's `beforeEach`. */
export function setWorkspaceUIMock(next: Partial<WorkspaceUIMockState>) {
  state.value = { ...defaultState, ...next }
}

export function useWorkspaceUI() {
  return {
    workspaceType: computed(() => state.value.workspaceType),
    permissions: computed(() => ({
      canManageSubscription: state.value.canManageSubscription,
      canTopUp: state.value.canTopUp
    }))
  }
}
