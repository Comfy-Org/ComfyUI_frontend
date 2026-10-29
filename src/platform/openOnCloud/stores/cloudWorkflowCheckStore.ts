import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'

import type {
  CloudWorkflowChecker,
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState,
  PrototypeScenario
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  prototypeCloudWorkflowChecker,
  reduceCloudWorkflowCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

/**
 * Whether Comfy Cloud can run the open workflow, rechecked on each call and
 * again, without a pause, when the prototype panel changes its answer.
 */
export const useCloudWorkflowCheckStore = defineStore(
  'cloudWorkflowCheck',
  () => {
    const prototypeScenario = ref<PrototypeScenario>('compatible')
    const uploadedModels = ref<string[]>([])
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    const pick = () => ({
      scenario: prototypeScenario.value,
      uploadedModels: uploadedModels.value
    })
    const checker = prototypeCloudWorkflowChecker(pick)
    const recheckNow = prototypeCloudWorkflowChecker(pick, 0)
    let lastRun = 0
    let lastWorkflow: ComfyWorkflowJSON | null = null

    function dispatch(event: CloudWorkflowCheckEvent) {
      state.value = reduceCloudWorkflowCheck(state.value, event)
    }

    async function run(
      workflow: ComfyWorkflowJSON,
      ask: CloudWorkflowChecker
    ): Promise<void> {
      const run = ++lastRun
      dispatch({ type: 'started', run })
      dispatch({ type: 'answered', run, verdict: await ask(workflow) })
    }

    function check(workflow: ComfyWorkflowJSON): Promise<void> {
      lastWorkflow = workflow
      return run(workflow, checker)
    }

    function markUploaded(names: readonly string[]) {
      uploadedModels.value = [...uploadedModels.value, ...names]
    }

    function forgetUploads() {
      uploadedModels.value = []
    }

    watch([prototypeScenario, uploadedModels], () => {
      if (lastWorkflow) void run(lastWorkflow, recheckNow)
    })

    return {
      state,
      prototypeScenario,
      check,
      markUploaded,
      forgetUploads
    }
  }
)
