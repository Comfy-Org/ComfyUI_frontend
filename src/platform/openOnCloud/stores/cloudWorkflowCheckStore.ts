import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type {
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState,
  PrototypeCloudCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  prototypeCloudWorkflowChecker,
  reduceCloudWorkflowCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'

/**
 * Whether Comfy Cloud can run the open workflow, rechecked on each call, and
 * whether the modal for its answer shows.
 */
export const useCloudWorkflowCheckStore = defineStore(
  'cloudWorkflowCheck',
  () => {
    const prototypeCheck = ref<PrototypeCloudCheck>('canOpen')
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    const checker = prototypeCloudWorkflowChecker(() => prototypeCheck.value)
    const isModalShown = computed(
      () => state.value.phase === 'answered' && state.value.showsModal
    )
    let lastRun = 0

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function check(): Promise<void> {
      const workflow = serializeRootGraph()
      if (!workflow) return
      const run = ++lastRun
      dispatch({ type: 'started', run })
      dispatch({ type: 'answered', run, verdict: await checker(workflow) })
    }

    function requestModal() {
      dispatch({ type: 'modalRequested' })
    }

    function dismissModal() {
      dispatch({ type: 'modalDismissed' })
    }

    return {
      state,
      prototypeCheck,
      isModalShown,
      check,
      requestModal,
      dismissModal
    }
  }
)
