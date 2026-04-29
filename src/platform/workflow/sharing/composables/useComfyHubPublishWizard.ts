import { useStepper } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'

import type {
  ComfyHubPublishFormData,
  ExampleImage
} from '@/platform/workflow/sharing/types/comfyHubTypes'
import type { PublishPrefill } from '@/platform/workflow/sharing/types/shareTypes'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const PUBLISH_STEPS = [
  'describe',
  'examples',
  'finish',
  'profileCreation'
] as const

export type ComfyHubPublishStep = (typeof PUBLISH_STEPS)[number]

// TODO: Migrate to a Pinia store alongside the profile gate singleton
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
    thumbnailUrl: null,
    comparisonBeforeFile: null,
    comparisonBeforeUrl: null,
    comparisonAfterFile: null,
    comparisonAfterUrl: null,
    exampleImages: [],
    tutorialUrl: '',
    metadata: {}
  }
}

function createExampleImagesFromUrls(urls: string[]): ExampleImage[] {
  return urls.map((url) => ({ id: uuidv4(), url }))
}

function nonBlobUrlsFromExampleImages(
  exampleImages: ComfyHubPublishFormData['exampleImages']
): string[] | undefined {
  const urls = exampleImages
    .map((img) => img.url)
    .filter((url) => url.length > 0 && !url.startsWith('blob:'))
  return urls.length > 0 ? urls : undefined
}

function extractPrefillFromFormData(
  formData: ComfyHubPublishFormData
): PublishPrefill {
  return {
    name: formData.name || undefined,
    description: formData.description || undefined,
    tags: formData.tags.length > 0 ? [...formData.tags] : undefined,
    models: formData.models.length > 0 ? [...formData.models] : undefined,
    customNodes:
      formData.customNodes.length > 0 ? [...formData.customNodes] : undefined,
    thumbnailType: formData.thumbnailType,
    thumbnailUrl:
      formData.thumbnailType !== 'imageComparison'
        ? (formData.thumbnailUrl ?? undefined)
        : (formData.comparisonBeforeUrl ?? undefined),
    thumbnailComparisonUrl:
      formData.thumbnailType === 'imageComparison'
        ? (formData.comparisonAfterUrl ?? undefined)
        : undefined,
    sampleImageUrls: nonBlobUrlsFromExampleImages(formData.exampleImages),
    tutorialUrl: formData.tutorialUrl || undefined,
    metadata:
      Object.keys(formData.metadata).length > 0 ? formData.metadata : undefined
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
    const resolvedThumbnailType =
      current.thumbnailType === defaults.thumbnailType
        ? (prefill.thumbnailType ?? current.thumbnailType)
        : current.thumbnailType
    const isComparison = resolvedThumbnailType === 'imageComparison'

    formData.value = {
      ...current,
      name:
        current.name === defaults.name
          ? (prefill.name ?? current.name)
          : current.name,
      description:
        current.description === defaults.description
          ? (prefill.description ?? current.description)
          : current.description,
      tags:
        current.tags.length === 0 && prefill.tags?.length
          ? prefill.tags
          : current.tags,
      models:
        current.models.length === 0 && prefill.models?.length
          ? prefill.models
          : current.models,
      customNodes:
        current.customNodes.length === 0 && prefill.customNodes?.length
          ? prefill.customNodes
          : current.customNodes,
      thumbnailType: resolvedThumbnailType,
      thumbnailUrl:
        !isComparison &&
        current.thumbnailFile === null &&
        current.thumbnailUrl === null
          ? (prefill.thumbnailUrl ?? null)
          : current.thumbnailUrl,
      comparisonBeforeUrl:
        isComparison &&
        current.comparisonBeforeFile === null &&
        current.comparisonBeforeUrl === null
          ? (prefill.thumbnailUrl ?? null)
          : current.comparisonBeforeUrl,
      comparisonAfterUrl:
        isComparison &&
        current.comparisonAfterFile === null &&
        current.comparisonAfterUrl === null
          ? (prefill.thumbnailComparisonUrl ?? null)
          : current.comparisonAfterUrl,
      exampleImages:
        current.exampleImages.length === 0 && prefill.sampleImageUrls?.length
          ? createExampleImagesFromUrls(prefill.sampleImageUrls)
          : current.exampleImages,
      tutorialUrl:
        current.tutorialUrl === defaults.tutorialUrl
          ? (prefill.tutorialUrl ?? current.tutorialUrl)
          : current.tutorialUrl,
      metadata:
        Object.keys(current.metadata).length === 0 &&
        prefill.metadata &&
        Object.keys(prefill.metadata).length > 0
          ? prefill.metadata
          : current.metadata
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
