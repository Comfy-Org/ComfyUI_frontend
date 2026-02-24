import { computed, ref } from 'vue'

import type { MarketplaceTemplate } from '@/types/templateMarketplace'

import type { PublishingStepDefinition } from '@/components/templatePublishing/types'
import { PUBLISHING_STEP_DEFINITIONS } from '@/components/templatePublishing/types'
import {
  loadTemplateUnderway,
  saveTemplateUnderway
} from '@/platform/workflow/templates/composables/useTemplatePublishStorage'

/**
 * Manages the state and navigation logic for the template publishing
 * wizard.
 *
 * Owns the current step, per-step validity tracking, and draft
 * persistence via {@link saveTemplateUnderway}/{@link loadTemplateUnderway}.
 *
 * @param options.initialStep - 1-indexed step to start on (defaults to 1)
 */
export function useTemplatePublishingStepper(options?: {
  initialStep?: number
}) {
  const totalSteps = PUBLISHING_STEP_DEFINITIONS.length

  const currentStep = ref(clampStep(options?.initialStep ?? 1, totalSteps))

  const template = ref<Partial<MarketplaceTemplate>>(
    loadTemplateUnderway() ?? {}
  )

  const stepValidity = ref<Record<number, boolean>>({})

  const stepDefinitions: PublishingStepDefinition[] =
    PUBLISHING_STEP_DEFINITIONS

  const isFirstStep = computed(() => currentStep.value === 1)
  const isLastStep = computed(() => currentStep.value === totalSteps)
  const canProceed = computed(
    () => stepValidity.value[currentStep.value] === true
  )

  function goToStep(step: number) {
    currentStep.value = clampStep(step, totalSteps)
  }

  function nextStep() {
    if (!isLastStep.value) {
      currentStep.value = clampStep(currentStep.value + 1, totalSteps)
    }
  }

  function prevStep() {
    if (!isFirstStep.value) {
      currentStep.value = clampStep(currentStep.value - 1, totalSteps)
    }
  }

  function saveDraft() {
    saveTemplateUnderway(template.value)
  }

  function setStepValid(step: number, valid: boolean) {
    stepValidity.value[step] = valid
  }

  return {
    currentStep,
    totalSteps,
    template,
    stepDefinitions,
    isFirstStep,
    isLastStep,
    canProceed,
    goToStep,
    nextStep,
    prevStep,
    saveDraft,
    setStepValid
  }
}

function clampStep(step: number, max: number): number {
  return Math.max(1, Math.min(step, max))
}
