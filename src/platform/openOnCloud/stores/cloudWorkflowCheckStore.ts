import { defineStore, storeToRefs } from 'pinia'
import { ref, shallowRef, watch } from 'vue'

import type {
  CloudWorkflowChecker,
  CloudWorkflowCheckEvent,
  CloudWorkflowCheckState,
  PrototypeScenario
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  prototypeCloudWorkflowChecker,
  prototypeVerdict,
  reduceCloudWorkflowCheck
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

type PrototypeLibrary = 'lacksModels' | 'hasModels'

/**
 * Whether Comfy Cloud can run the open workflow, rechecked on each call and
 * on each sign-in or sign-out, and answered at once when the prototype panel
 * changes its answer.
 */
export const useCloudWorkflowCheckStore = defineStore(
  'cloudWorkflowCheck',
  () => {
    const { signedIn } = storeToRefs(useLocalSignInStore())
    const prototypeScenario = ref<PrototypeScenario>('compatible')
    const prototypeLibrary = ref<PrototypeLibrary>('lacksModels')
    const uploadedModels = ref<string[]>([])
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    const pick = () => ({
      scenario: prototypeScenario.value,
      signedIn: signedIn.value,
      libraryHasModels: prototypeLibrary.value === 'hasModels',
      uploadedModels: uploadedModels.value
    })
    const checker = prototypeCloudWorkflowChecker(pick)
    let lastRun = 0
    let lastWorkflow: ComfyWorkflowJSON | undefined

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

    function answerFromPanel() {
      const run = ++lastRun
      dispatch({ type: 'started', run })
      const verdict = prototypeVerdict(pick())
      if (verdict) dispatch({ type: 'answered', run, verdict })
    }

    function markUploaded(names: readonly string[]) {
      uploadedModels.value = [...uploadedModels.value, ...names]
    }

    function forgetUploads() {
      uploadedModels.value = []
    }

    watch([prototypeScenario, prototypeLibrary, uploadedModels], () => {
      if (lastWorkflow) answerFromPanel()
    })

    watch(signedIn, () => {
      if (lastWorkflow) void run(lastWorkflow, checker)
    })

    return {
      state,
      prototypeScenario,
      prototypeLibrary,
      check,
      markUploaded,
      forgetUploads
    }
  }
)
