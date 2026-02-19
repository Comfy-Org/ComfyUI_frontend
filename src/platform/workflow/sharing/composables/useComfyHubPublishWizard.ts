import { useStepper } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const PUBLISH_STEPS = ['describe', 'examples', 'finish'] as const

export type ComfyHubPublishStep = (typeof PUBLISH_STEPS)[number]

function createDefaultFormData(): ComfyHubPublishFormData {
  const { activeWorkflow } = useWorkflowStore()
  return {
    name: activeWorkflow?.filename ?? '',
    description: '',
    tags: [],
    thumbnailType: 'image',
    thumbnailFile: null
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

  function resetWizard() {
    stepper.goTo('describe')
    formData.value = createDefaultFormData()
  }

  return {
    currentStep: stepper.current,
    formData,
    canGoNext,
    isFirstStep: stepper.isFirst,
    isLastStep: stepper.isLast,
    goToStep: stepper.goTo,
    goNext: stepper.goToNext,
    goBack: stepper.goToPrevious,
    resetWizard
  }
}
