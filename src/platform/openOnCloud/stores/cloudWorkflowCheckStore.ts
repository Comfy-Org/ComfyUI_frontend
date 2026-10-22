import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type {
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState,
  PrototypeCloudCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  prototypeCloudWorkflowChecker,
  reduceCloudWorkflowCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

/** Whether Comfy Cloud can run the open workflow, rechecked on each call. */
export const useCloudWorkflowCheckStore = defineStore(
  'cloudWorkflowCheck',
  () => {
    const prototypeCheck = ref<PrototypeCloudCheck>('canOpen')
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    const checker = prototypeCloudWorkflowChecker(() => prototypeCheck.value)
    let lastRun = 0

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function check(workflow: ComfyWorkflowJSON): Promise<void> {
      const run = ++lastRun
      dispatch({ type: 'started', run })
      dispatch({ type: 'answered', run, verdict: await checker(workflow) })
    }

    return { state, prototypeCheck, check }
  }
)
