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
    const { isLoggedIn } = useCurrentUser()
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    let lastRun = 0

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function check(): Promise<void> {
      const run = ++lastRun
      dispatch({ type: 'started', run })
      try {
        const verdict = await checkCloudCompatibility()
        dispatch(
          verdict ? { type: 'answered', run, verdict } : { type: 'failed', run }
        )
      } catch {
        dispatch({ type: 'failed', run })
      }
    }

    function invalidate() {
      dispatch({ type: 'invalidated' })
    }

    const workflowStore = useWorkflowStore()
    useEventListener(api, 'graphChanged', invalidate)
    watch(() => workflowStore.activeWorkflow, invalidate, { flush: 'sync' })

    watch(isLoggedIn, () => {
      if (lastRun) void check()
    })

    return { state, check }
  }
)
