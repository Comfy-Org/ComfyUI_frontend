import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { api } from '@/scripts/api'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import type {
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { reduceCloudWorkflowCheck } from '@/platform/openOnCloud/cloudWorkflowCheck'

export const useCloudWorkflowCheckStore = defineStore(
  'cloudWorkflowCheck',
  () => {
    const { isLoggedIn, resolvedUserInfo } = useCurrentUser()
    const { flags } = useFeatureFlags()
    const workspaces = useTeamWorkspaceStore()
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    let lastRun = 0

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function check(): Promise<void> {
      const run = ++lastRun
      dispatch({ type: 'started', run })
      const result = await checkCloudCompatibility()
      if (result?.kind === 'unreadableModelLoader') {
        dispatch({ type: 'failed', run, nodeType: result.nodeType })
      } else if (result) {
        dispatch({ type: 'answered', run, verdict: result })
      } else {
        dispatch({ type: 'failed', run })
      }
    }

    function invalidate() {
      dispatch({ type: 'invalidated' })
    }

    const workflowStore = useWorkflowStore()
    useEventListener(api, 'graphChanged', invalidate)
    watch(() => workflowStore.activeWorkflow, invalidate, { flush: 'sync' })

    watch(
      [
        isLoggedIn,
        () => resolvedUserInfo.value?.id,
        () => workspaces.activeWorkspaceId,
        () => flags.openOnCloudModelUploadEnabled
      ],
      () => {
        if (state.value.phase !== 'idle') void check()
      },
      { flush: 'sync' }
    )

    return { state, check, invalidate }
  }
)
