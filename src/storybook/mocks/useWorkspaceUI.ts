import { computed, ref } from 'vue'

import type {
  WorkspaceRole,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'

export interface WorkspaceUIMockState {
  workspaceType: WorkspaceType
  workspaceRole: WorkspaceRole
}

const defaultState: WorkspaceUIMockState = {
  workspaceType: 'team',
  workspaceRole: 'owner'
}

const state = ref<WorkspaceUIMockState>({ ...defaultState })

export function setWorkspaceUIMock(next: Partial<WorkspaceUIMockState>) {
  state.value = { ...defaultState, ...next }
}

export function useWorkspaceUI() {
  return {
    workspaceType: computed(() => state.value.workspaceType),
    workspaceRole: computed(() => state.value.workspaceRole),
    permissions: computed(() => ({
      canViewOtherMembers:
        state.value.workspaceType === 'team' ||
        state.value.workspaceRole === 'member',
      canViewPendingInvites:
        state.value.workspaceType === 'team' &&
        state.value.workspaceRole === 'owner'
    }))
  }
}
