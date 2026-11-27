import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { nextTick, shallowRef, watch } from 'vue'

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
    const isSwitchedOffOnCloud = shallowRef(false)
    const workflowRevision = shallowRef(0)
    let lastRun = 0
    let identityRevision = 0
    let activeCheck:
      | { controller: AbortController; refreshingGrant: boolean }
      | undefined
    let confirmedUploads: ConfirmedWorkspaceModels | undefined

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function check({
      refreshUploadGrant = false,
      canRequest,
      signal
    }: {
      refreshUploadGrant?: boolean
      canRequest?: () => boolean
      signal?: AbortSignal
    } = {}): Promise<void> {
      if (signal?.aborted) return
      activeCheck?.controller.abort()
      const controller = new AbortController()
      const pending = { controller, refreshingGrant: refreshUploadGrant }
      activeCheck = pending
      const cancelPendingCheck = () => {
        if (activeCheck === pending) invalidate()
      }
      signal?.addEventListener('abort', cancelPendingCheck, { once: true })

      try {
        const run = ++lastRun
        dispatch({ type: 'started', run })
        if (refreshUploadGrant) {
          await bindLocalOpenOnCloudGrant().revalidate()
          pending.refreshingGrant = false
          if (controller.signal.aborted) return
          if (canRequest && !canRequest()) {
            invalidate()
            return
          }
        }
        const result = await checkCloudCompatibility(
          confirmedUploads,
          controller.signal
        )
        if (controller.signal.aborted) return
        if (result?.kind === 'canOpen' || result?.kind === 'missing') {
          dispatch({ type: 'answered', run, verdict: result })
        } else {
          dispatch({ type: 'failed', run, blocker: result })
          if (result?.kind === 'checkFailed' && result.reason === 'switchedOff')
            await hideAfterFailureIsShown(run)
        }
      } finally {
        signal?.removeEventListener('abort', cancelPendingCheck)
        if (activeCheck === pending) activeCheck = undefined
      }
    }

    async function hideAfterFailureIsShown(run: number) {
      const identity = identityRevision
      await nextTick()
      if (run === lastRun && identity === identityRevision)
        isSwitchedOffOnCloud.value = true
    }

    function invalidate() {
      activeCheck?.controller.abort()
      activeCheck = undefined
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

    function invalidateWorkflow() {
      workflowRevision.value++
      invalidate()
    }

    function bindWorkflowRevision() {
      const revision = workflowRevision.value
      return () => revision === workflowRevision.value
    }

    const workflowStore = useWorkflowStore()
    useEventListener(api, 'graphChanged', invalidateWorkflow)
    watch(() => workflowStore.activeWorkflow, invalidateWorkflow, {
      flush: 'sync'
    })

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
        if (identityChanged || workspaceId !== previousWorkspace) {
          confirmedUploads = undefined
          identityRevision++
          isSwitchedOffOnCloud.value = false
        }

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
        if (!activeCheck?.refreshingGrant) invalidate()
      },
      { flush: 'sync' }
    )

    return {
      state,
      isSwitchedOffOnCloud,
      check,
      invalidate,
      bindWorkflowRevision,
      rememberConfirmedUploads
    }
  }
)
