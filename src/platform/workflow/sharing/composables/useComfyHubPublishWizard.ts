import { useStepper } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const PUBLISH_STEPS = [
  'describe',
  'examples',
  'finish',
  'profileCreation'
] as const

export type ComfyHubPublishStep = (typeof PUBLISH_STEPS)[number]

function createDefaultFormData(): ComfyHubPublishFormData {
  const { activeWorkflow } = useWorkflowStore()
  return {
    name: activeWorkflow?.filename ?? '',
    description: '',
    workflowType: '',
    tags: [],
    thumbnailType: 'image',
    thumbnailFile: null,
    comparisonBeforeFile: null,
    comparisonAfterFile: null,
    exampleImages: [],
    selectedExampleIds: []
  }
}

export function useComfyHubPublishWizard() {
  const stepper = useStepper([...PUBLISH_STEPS])
  const formData = ref<ComfyHubPublishFormData>(createDefaultFormData())

  const canGoNext = computed(() => {
    if (stepper.isCurrent('describe')) {
      return formData.value.name.trim().length > 0
    }
    return true
  })

  const isLastStep = computed(() => stepper.isCurrent('finish'))
  const isProfileCreationStep = computed(() =>
    stepper.isCurrent('profileCreation')
  )

  function openProfileCreationStep() {
    stepper.goTo('profileCreation')
  }

  function closeProfileCreationStep() {
    stepper.goTo('finish')
  }

  return {
    currentStep: stepper.current,
    formData,
    canGoNext,
    isFirstStep: stepper.isFirst,
    isLastStep,
    isProfileCreationStep,
    goToStep: stepper.goTo,
    goNext: stepper.goToNext,
    goBack: stepper.goToPrevious,
    openProfileCreationStep,
    closeProfileCreationStep
  }
}
