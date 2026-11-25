import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { api } from '@/scripts/api'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
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
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    let lastRun = 0
    let activeCheck: AbortController | undefined

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function check(signal?: AbortSignal): Promise<void> {
      if (signal?.aborted) return
      activeCheck?.abort()
      const controller = new AbortController()
      activeCheck = controller
      const cancelPendingCheck = () => {
        if (activeCheck === controller) invalidate()
      }
      signal?.addEventListener('abort', cancelPendingCheck, { once: true })

      try {
        const run = ++lastRun
        dispatch({ type: 'started', run })
        const result = await checkCloudCompatibility(controller.signal)
        if (controller.signal.aborted) return
        if (result?.kind === 'canOpen' || result?.kind === 'missing') {
          dispatch({ type: 'answered', run, verdict: result })
        } else {
          dispatch({ type: 'failed', run, blocker: result })
        }
      } finally {
        signal?.removeEventListener('abort', cancelPendingCheck)
        if (activeCheck === controller) activeCheck = undefined
      }
    }

    function invalidate() {
      activeCheck?.abort()
      activeCheck = undefined
      dispatch({ type: 'invalidated' })
    }

    const workflowStore = useWorkflowStore()
    useEventListener(api, 'graphChanged', invalidate)
    watch(() => workflowStore.activeWorkflow, invalidate, { flush: 'sync' })

    watch([isLoggedIn, () => resolvedUserInfo.value?.id], invalidate, {
      flush: 'sync'
    })

    return { state, check }
  }
)
