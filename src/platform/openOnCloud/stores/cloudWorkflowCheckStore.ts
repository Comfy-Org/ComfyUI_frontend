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
import { bindLocalOpenOnCloudGrant } from '@/platform/openOnCloud/localOpenOnCloudRollout'

export const useCloudWorkflowCheckStore = defineStore(
  'cloudWorkflowCheck',
  () => {
    const { isApiKeyLogin, isLoggedIn, resolvedUserInfo } = useCurrentUser()
    const { flags } = useFeatureFlags()
    const workspaces = useTeamWorkspaceStore()
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    let lastRun = 0
    let refreshingGrantFor: CloudWorkflowCheckState | undefined
    let confirmedUploads: ConfirmedWorkspaceModels | undefined

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function check({
      refreshUploadGrant = false,
      canRequest
    }: {
      refreshUploadGrant?: boolean
      canRequest?: () => boolean
    } = {}): Promise<void> {
      const run = ++lastRun
      dispatch({ type: 'started', run })
      if (refreshUploadGrant) {
        const started = state.value
        refreshingGrantFor = started
        await bindLocalOpenOnCloudGrant().revalidate()
        if (refreshingGrantFor === started) refreshingGrantFor = undefined
        if (state.value !== started) return
        if (canRequest && !canRequest()) {
          invalidate()
          return
        }
      }
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
        () => workspaces.activeWorkspaceId ?? desktopHostUser.value?.workspaceId
      ],
      (
        [signedIn, userId, workspaceId],
        [wasSignedIn, previousUser, previousWorkspace]
      ) => {
        const identityChanged =
          signedIn !== wasSignedIn || userId !== previousUser
        if (identityChanged || workspaceId !== previousWorkspace)
          confirmedUploads = undefined

        const initializingWorkspaceForCheck =
          !identityChanged &&
          !previousWorkspace &&
          !!workspaceId &&
          signedIn &&
          !isApiKeyLogin.value &&
          flags.openOnCloudModelUploadEnabled &&
          workspaces.initState === 'loading' &&
          state.value.phase === 'checking'

        if (!initializingWorkspaceForCheck) invalidate()
      },
      { flush: 'sync' }
    )
    watch(
      () => flags.openOnCloudModelUploadEnabled,
      () => {
        if (state.value !== refreshingGrantFor) invalidate()
      },
      { flush: 'sync' }
    )

    return { state, check, invalidate, rememberConfirmedUploads }
  }
)
