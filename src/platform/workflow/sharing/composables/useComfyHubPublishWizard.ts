import { useStepper } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'

import type {
  ComfyHubPublishFormData,
  ExampleImage
} from '@/platform/workflow/sharing/types/comfyHubTypes'
import type { PublishPrefill } from '@/platform/workflow/sharing/types/shareTypes'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { normalizeTags } from '@/platform/workflow/sharing/utils/normalizeTags'

const PUBLISH_STEPS = [
  'describe',
  'examples',
  'finish',
  'profileCreation'
] as const

export type ComfyHubPublishStep = (typeof PUBLISH_STEPS)[number]

const cachedPrefills = new Map<string, PublishPrefill>()

function createDefaultFormData(): ComfyHubPublishFormData {
  const workflowStore = useWorkflowStore()
  return {
    name: workflowStore.activeWorkflow?.filename ?? '',
    description: '',
    tags: [],
    models: [],
    customNodes: [],
    thumbnailType: 'image',
    thumbnailFile: null,
    comparisonBeforeFile: null,
    comparisonAfterFile: null,
    exampleImages: [],
    tutorialUrl: '',
    metadata: {}
  }
}

function createExampleImagesFromUrls(urls: string[]): ExampleImage[] {
  return urls.map((url) => ({ id: uuidv4(), url }))
}

function extractPrefillFromFormData(
  formData: ComfyHubPublishFormData
): PublishPrefill {
  return {
    description: formData.description || undefined,
    tags: formData.tags.length > 0 ? normalizeTags(formData.tags) : undefined,
    thumbnailType: formData.thumbnailType,
    sampleImageUrls: formData.exampleImages
      .map((img) => img.url)
      .filter((url) => !url.startsWith('blob:'))
  }
}

export function cachePublishPrefill(
  workflowPath: string,
  formData: ComfyHubPublishFormData
) {
  cachedPrefills.set(workflowPath, extractPrefillFromFormData(formData))
}

export function getCachedPrefill(workflowPath: string): PublishPrefill | null {
  return cachedPrefills.get(workflowPath) ?? null
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

  function applyPrefill(prefill: PublishPrefill) {
    const defaults = createDefaultFormData()
    const current = formData.value
    formData.value = {
      ...current,
      description:
        current.description === defaults.description
          ? (prefill.description ?? current.description)
          : current.description,
      tags:
        current.tags.length === 0 && prefill.tags?.length
          ? prefill.tags
          : current.tags,
      thumbnailType:
        current.thumbnailType === defaults.thumbnailType
          ? (prefill.thumbnailType ?? current.thumbnailType)
          : current.thumbnailType,
      exampleImages:
        current.exampleImages.length === 0 && prefill.sampleImageUrls?.length
          ? createExampleImagesFromUrls(prefill.sampleImageUrls)
          : current.exampleImages
    }
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
    closeProfileCreationStep,
    applyPrefill
  }
}
