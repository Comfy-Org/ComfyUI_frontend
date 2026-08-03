import { createSharedComposable, useEventListener } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { runWhenGlobalIdle } from '@/base/common/async'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { registerTour } from '@/platform/onboarding/onboardingTours'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

import {
  RUN_BUTTON_SELECTOR,
  firstRunTourSteps,
  releaseFirstRunTargets
} from './firstRunTourDefinition'
import type { RunState } from './firstRunTourDefinition'

const IDLE_TIMEOUT_MS = 800

async function afterMountSettles() {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  )
  await new Promise<void>((resolve) =>
    runWhenGlobalIdle(() => resolve(), IDLE_TIMEOUT_MS)
  )
}

function useFirstRunTourControllerInternal() {
  const engine = useOnboardingTourStore()
  const billing = useBillingContext()
  const executionErrorStore = useExecutionErrorStore()
  const settingStore = useSettingStore()

  const onRunStep = computed(
    () => engine.activeTour === 'firstRun' && engine.step?.name === 'run'
  )

  const runState = ref<RunState>('idle')
  const settle = (state: RunState) => () => {
    if (runState.value === 'generating') runState.value = state
  }
  useEventListener(api, 'execution_success', settle('succeeded'))
  useEventListener(api, 'execution_error', settle('failed'))
  useEventListener(api, 'execution_interrupted', settle('failed'))
  watch(
    () =>
      executionErrorStore.hasNodeError || executionErrorStore.hasPromptError,
    (refused) => {
      if (refused && runState.value === 'generating') runState.value = 'failed'
    }
  )

  function onRunClick(event: MouseEvent) {
    if (!onRunStep.value) return
    if (!(event.target instanceof Element)) return
    if (!event.target.closest(RUN_BUTTON_SELECTOR)) return
    if (runState.value === 'generating') {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    if (!billing.canRunWorkflows.value) {
      event.preventDefault()
      event.stopImmediatePropagation()
      billing.showSubscriptionDialog({ reason: 'out_of_credits' })
      engine.postpone()
      return
    }
    runState.value = 'generating'
    engine.next()
  }

  let previousDragCanvas: boolean | undefined
  watch(
    () => engine.activeTour === 'firstRun',
    (active) => {
      const canvas = app.canvas
      if (active) {
        document.addEventListener('click', onRunClick, { capture: true })
        previousDragCanvas = canvas?.allow_dragcanvas
        if (canvas) canvas.allow_dragcanvas = false
        return
      }
      document.removeEventListener('click', onRunClick, { capture: true })
      if (canvas && previousDragCanvas !== undefined)
        canvas.allow_dragcanvas = previousDragCanvas
      releaseFirstRunTargets()
      runState.value = 'idle'
    }
  )

  let beginSeq = 0

  async function beginTour(templateId: string): Promise<boolean> {
    const seq = ++beginSeq
    if (!settingStore.get('Comfy.VueNodes.Enabled'))
      await settingStore.set('Comfy.VueNodes.Enabled', true)
    runState.value = 'idle'
    registerTour('firstRun', () => firstRunTourSteps(templateId, runState))
    await afterMountSettles()
    if (seq !== beginSeq) return false
    const started = engine.startTour('firstRun')
    if (!started) releaseFirstRunTargets()
    return started
  }

  return { beginTour }
}

export const useFirstRunTourController = createSharedComposable(
  useFirstRunTourControllerInternal
)
