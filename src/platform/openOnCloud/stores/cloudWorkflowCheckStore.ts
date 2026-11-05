import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

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
import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

export const useCloudWorkflowCheckStore = defineStore(
  'cloudWorkflowCheck',
  () => {
    const { signedIn } = storeToRefs(useLocalSignInStore())
    const prototypeScenario = ref<PrototypeScenario | 'live'>('live')
    const uploadedModels = ref<string[]>([])
    const state = shallowRef<CloudWorkflowCheckState>({ phase: 'idle' })
    const pick = () => ({
      scenario:
        prototypeScenario.value === 'live'
          ? ('compatible' as const)
          : prototypeScenario.value,
      signedIn: signedIn.value,
      libraryHasModels: false,
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
      try {
        const verdict = await ask(workflow)
        dispatch(
          verdict ? { type: 'answered', run, verdict } : { type: 'failed', run }
        )
      } catch {
        dispatch({ type: 'failed', run })
      }
    }

    function check(workflow: ComfyWorkflowJSON): Promise<void> {
      lastWorkflow = workflow
      return run(workflow, preview.value ? checker : checkCloudCompatibility)
    }

    const preview = computed(
      () => import.meta.env.DEV && prototypeScenario.value !== 'live'
    )

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

    watch([prototypeScenario, uploadedModels], () => {
      if (!lastWorkflow) return
      if (preview.value) answerFromPanel()
      else void check(lastWorkflow)
    })

    watch(signedIn, () => {
      if (lastWorkflow) void check(lastWorkflow)
    })

    return {
      state,
      preview,
      prototypeScenario,
      check,
      markUploaded,
      forgetUploads
    }
  }
)
