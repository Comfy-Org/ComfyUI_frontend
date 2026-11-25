import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { api } from '@/scripts/api'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { desktopHostUser } from '@/platform/auth/desktopHost/desktopHostSession'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import type { ConfirmedWorkspaceModels } from '@/platform/openOnCloud/cloudCompatibilityApi'
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
    let confirmedUploads: ConfirmedWorkspaceModels | undefined

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function check(): Promise<void> {
      const run = ++lastRun
      dispatch({ type: 'started', run })
      const result = await checkCloudCompatibility(confirmedUploads)
      if (result?.kind === 'canOpen' || result?.kind === 'missing') {
        dispatch({ type: 'answered', run, verdict: result })
      } else {
        dispatch({ type: 'failed', run, blocker: result })
      }
    }

    function invalidate() {
      dispatch({ type: 'invalidated' })
    }

    function rememberConfirmedUploads({
      workspaceId,
      models
    }: ConfirmedWorkspaceModels) {
      const existing =
        confirmedUploads?.workspaceId === workspaceId
          ? confirmedUploads.models
          : []
      const combined = new Map(
        [...existing, ...models].map((model) => [
          JSON.stringify([model.folder, model.name]),
          model
        ])
      )
      confirmedUploads = { workspaceId, models: [...combined.values()] }
    }

    const workflowStore = useWorkflowStore()
    useEventListener(api, 'graphChanged', invalidate)
    watch(() => workflowStore.activeWorkflow, invalidate, { flush: 'sync' })

    watch(
      [
        isLoggedIn,
        () => resolvedUserInfo.value?.id,
        () =>
          workspaces.activeWorkspaceId ?? desktopHostUser.value?.workspaceId,
        () => flags.openOnCloudModelUploadEnabled
      ],
      (
        [signedIn, userId, workspaceId],
        [wasSignedIn, previousUser, previousWorkspace]
      ) => {
        if (
          signedIn !== wasSignedIn ||
          userId !== previousUser ||
          workspaceId !== previousWorkspace
        )
          confirmedUploads = undefined
        if (state.value.phase !== 'idle') void check()
      },
      { flush: 'sync' }
    )

    return { state, check, invalidate, rememberConfirmedUploads }
  }
)
