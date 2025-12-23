import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { st } from '@/i18n'
import { civitaiImportSource } from '@/platform/assets/importSources/civitaiImportSource'
import { huggingfaceImportSource } from '@/platform/assets/importSources/huggingfaceImportSource'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import type { ImportSource } from '@/platform/assets/types/importSource'
import { validateSourceUrl } from '@/platform/assets/utils/importSourceUtil'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

interface WizardData {
  url: string
  metadata?: AssetMetadata
  name: string
  tags: string[]
  previewImage?: string
}

interface ModelTypeOption {
  name: string
  value: string
}

export function useUploadModelWizard(modelTypes: Ref<ModelTypeOption[]>) {
  const { t } = useI18n()
  const assetsStore = useAssetsStore()
  const assetDownloadStore = useAssetDownloadStore()
  const modelToNodeStore = useModelToNodeStore()
  const { flags } = useFeatureFlags()
  const currentStep = ref(1)
  const isFetchingMetadata = ref(false)
  const isUploading = ref(false)
  const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const uploadError = ref('')

  const wizardData = ref<WizardData>({
    url: '',
    name: '',
    tags: []
  })

  const selectedModelType = ref<string>()

  // Available import sources
  const importSources: ImportSource[] = flags.huggingfaceModelImportEnabled
    ? [civitaiImportSource, huggingfaceImportSource]
    : [civitaiImportSource]

  // Detected import source based on URL
  const detectedSource = computed(() => {
    const url = wizardData.value.url.trim()
    if (!url) return null
    return (
      importSources.find((source) => validateSourceUrl(url, source)) ?? null
    )
  })

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

    // Validate URL belongs to a supported import source
    const source = detectedSource.value
    if (!source) {
      const supportedSources = importSources.map((s) => s.name).join(', ')
      uploadError.value = t('assetBrowser.unsupportedUrlSource', {
        sources: supportedSources
      })
      return
    }

    isFetchingMetadata.value = true
    try {
      const metadata = await assetService.getAssetMetadata(wizardData.value.url)

      // Decode URL-encoded filenames (e.g., Chinese characters)
      if (metadata.filename) {
        try {
          metadata.filename = decodeURIComponent(metadata.filename)
        } catch {
          // Keep original if decoding fails
        }
      }
      if (metadata.name) {
        try {
          metadata.name = decodeURIComponent(metadata.name)
        } catch {
          // Keep original if decoding fails
        }
      }

      wizardData.value.metadata = metadata

      // Pre-fill name from metadata
      wizardData.value.name = metadata.filename || metadata.name || ''

      // Store preview image if available
      wizardData.value.previewImage = metadata.preview_image

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

  async function uploadPreviewImage(
    filename: string
  ): Promise<string | undefined> {
    if (!wizardData.value.previewImage) return undefined

    try {
      const baseFilename = filename.split('.')[0]
      let extension = 'png'
      const mimeMatch = wizardData.value.previewImage.match(
        /^data:image\/([^;]+);/
      )
      if (mimeMatch) {
        extension = mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]
      }

      const previewAsset = await assetService.uploadAssetFromBase64({
        data: wizardData.value.previewImage,
        name: `${baseFilename}_preview.${extension}`,
        tags: ['preview']
      })
      return previewAsset.id
    } catch (error) {
      console.error('Failed to upload preview image:', error)
      return undefined
    }
  }

  async function refreshModelCaches() {
    if (!selectedModelType.value) return

    const providers = modelToNodeStore.getAllNodeProviders(
      selectedModelType.value
    )
    await Promise.all(
      providers.map((provider) =>
        assetsStore.updateModelsForNodeType(provider.nodeDef.name)
      )
    )
  }

  async function uploadModel() {
    if (!canUploadModel.value) return

    const source = detectedSource.value
    if (!source) {
      uploadError.value = t('assetBrowser.noValidSourceDetected')
      return false
    }

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

      const previewId = await uploadPreviewImage(filename)
      const userMetadata = {
        source: source.type,
        source_url: wizardData.value.url,
        model_type: selectedModelType.value
      }

      if (flags.asyncModelUploadEnabled) {
        const result = await assetService.uploadAssetAsync({
          source_url: wizardData.value.url,
          tags,
          user_metadata: userMetadata,
          preview_id: previewId
        })

        if (result.type === 'async') {
          assetDownloadStore.onTaskComplete(
            result.task.task_id,
            refreshModelCaches
          )
          uploadStatus.value = 'success'
          currentStep.value = 3
          return { taskId: result.task.task_id }
        }

        uploadStatus.value = 'success'
        currentStep.value = 3
        await refreshModelCaches()
        return true
      }

      await assetService.uploadAssetFromUrl({
        url: wizardData.value.url,
        name: filename,
        tags,
        user_metadata: userMetadata,
        preview_id: previewId
      })

      uploadStatus.value = 'success'
      currentStep.value = 3
      await refreshModelCaches()
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
    detectedSource,

    // Actions
    fetchMetadata,
    uploadModel,
    goToPreviousStep
  }
}
