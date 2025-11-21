import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

import { st } from '@/i18n'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'

interface WizardData {
  url: string
  metadata: AssetMetadata | null
  name: string
  tags: string[]
}

interface ModelTypeOption {
  name: string
  value: string
}

export function useUploadModelWizard(modelTypes: Ref<ModelTypeOption[]>) {
  const currentStep = ref(1)
  const isFetchingMetadata = ref(false)
  const isUploading = ref(false)
  const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const uploadError = ref('')

  const wizardData = ref<WizardData>({
    url: '',
    metadata: null,
    name: '',
    tags: []
  })

  const selectedModelType = ref<string | undefined>(undefined)

  // Clear error when URL changes
  watch(
    () => wizardData.value.url,
    () => {
      uploadError.value = ''
    }
  )

  // Validation
  const canFetchMetadata = computed(() => {
    return wizardData.value.url.trim().length > 0
  })

  const canUploadModel = computed(() => {
    return !!selectedModelType.value
  })

  function isCivitaiUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname === 'civitai.com' || hostname.endsWith('.civitai.com')
    } catch {
      return false
    }
  }

  async function fetchMetadata() {
    if (!canFetchMetadata.value) return

    // Clean and normalize URL
    let cleanedUrl = wizardData.value.url.trim()
    try {
      cleanedUrl = new URL(encodeURI(cleanedUrl)).toString()
    } catch {
      // If URL parsing fails, just use the trimmed input
    }
    wizardData.value.url = cleanedUrl

    if (!isCivitaiUrl(wizardData.value.url)) {
      uploadError.value = st(
        'assetBrowser.onlyCivitaiUrlsSupported',
        'Only Civitai URLs are supported'
      )
      return
    }

    isFetchingMetadata.value = true
    try {
      const metadata = await assetService.getAssetMetadata(wizardData.value.url)
      wizardData.value.metadata = metadata

      // Pre-fill name from metadata
      wizardData.value.name = metadata.filename || metadata.name || ''

      // Pre-fill model type from metadata tags if available
      if (metadata.tags && metadata.tags.length > 0) {
        wizardData.value.tags = metadata.tags
        // Try to detect model type from tags
        const typeTag = metadata.tags.find((tag) =>
          modelTypes.value.some((type) => type.value === tag)
        )
        if (typeTag) {
          selectedModelType.value = typeTag
        }
      }

      currentStep.value = 2
    } catch (error) {
      console.error('Failed to retrieve metadata:', error)
      uploadError.value =
        error instanceof Error
          ? error.message
          : st(
              'assetBrowser.uploadModelFailedToRetrieveMetadata',
              'Failed to retrieve metadata. Please check the link and try again.'
            )
      currentStep.value = 1
    } finally {
      isFetchingMetadata.value = false
    }
  }

  async function uploadModel() {
    if (!canUploadModel.value) return

    isUploading.value = true
    uploadStatus.value = 'uploading'

    try {
      const tags = selectedModelType.value
        ? ['models', selectedModelType.value]
        : ['models']
      const filename =
        wizardData.value.metadata?.filename ||
        wizardData.value.metadata?.name ||
        'model'

      await assetService.uploadAssetFromUrl({
        url: wizardData.value.url,
        name: filename,
        tags,
        user_metadata: {
          source: 'civitai',
          source_url: wizardData.value.url,
          model_type: selectedModelType.value
        }
      })

      uploadStatus.value = 'success'
      currentStep.value = 3
      return true
    } catch (error) {
      console.error('Failed to upload asset:', error)
      uploadStatus.value = 'error'
      uploadError.value =
        error instanceof Error ? error.message : 'Failed to upload model'
      currentStep.value = 3
      return false
    } finally {
      isUploading.value = false
    }
  }

  function goToPreviousStep() {
    if (currentStep.value > 1) {
      currentStep.value = currentStep.value - 1
    }
  }

  return {
    // State
    currentStep,
    isFetchingMetadata,
    isUploading,
    uploadStatus,
    uploadError,
    wizardData,
    selectedModelType,

    // Computed
    canFetchMetadata,
    canUploadModel,

    // Actions
    fetchMetadata,
    uploadModel,
    goToPreviousStep
  }
}
