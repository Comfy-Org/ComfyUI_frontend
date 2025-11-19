<template>
  <div class="upload-model-dialog flex flex-col justify-between gap-6 p-4 pt-6">
    <!-- Step 1: Enter URL -->
    <UploadModelUrlInput
      v-if="currentStep === 1"
      v-model="wizardData.url"
      :error="uploadError"
    />

    <!-- Step 2: Confirm Metadata -->
    <UploadModelConfirmation
      v-else-if="currentStep === 2"
      v-model="selectedModelType"
      :metadata="wizardData.metadata"
    />

    <!-- Step 3: Upload Progress -->
    <UploadModelProgress
      v-else-if="currentStep === 3"
      :status="uploadStatus"
      :error="uploadError"
      :metadata="wizardData.metadata"
      :model-type="selectedModelType"
    />

    <!-- Navigation Footer -->
    <UploadModelFooter
      :current-step="currentStep"
      :is-fetching-metadata="isFetchingMetadata"
      :is-uploading="isUploading"
      :can-fetch-metadata="canFetchMetadata"
      :can-upload-model="canUploadModel"
      :upload-status="uploadStatus"
      :on-back="goToPreviousStep"
      :on-fetch-metadata="handleFetchMetadata"
      :on-upload="handleUploadModel"
      :on-close="handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { st } from '@/i18n'
import UploadModelConfirmation from '@/platform/assets/components/UploadModelConfirmation.vue'
import UploadModelFooter from '@/platform/assets/components/UploadModelFooter.vue'
import UploadModelProgress from '@/platform/assets/components/UploadModelProgress.vue'
import UploadModelUrlInput from '@/platform/assets/components/UploadModelUrlInput.vue'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

const emit = defineEmits<{
  'upload-success': []
}>()

const currentStep = ref(1)
const isFetchingMetadata = ref(false)
const isUploading = ref(false)
const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
const uploadError = ref('')

const wizardData = ref<{
  url: string
  metadata: AssetMetadata | null
  name: string
  tags: string[]
}>({
  url: '',
  metadata: null,
  name: '',
  tags: []
})

const selectedModelType = ref<string | undefined>(undefined)

const { modelTypes, fetchModelTypes } = useModelTypes()

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

async function handleFetchMetadata() {
  if (!canFetchMetadata.value) return

  // Validate that URL is from Civitai domain
  const isCivitaiUrl = (url: string): boolean => {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname === 'civitai.com' || hostname.endsWith('.civitai.com')
    } catch {
      return false
    }
  }

  if (!isCivitaiUrl(wizardData.value.url)) {
    uploadError.value = 'Only Civitai URLs are supported'
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

async function handleUploadModel() {
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
    emit('upload-success')
  } catch (error) {
    console.error('Failed to upload asset:', error)
    uploadStatus.value = 'error'
    uploadError.value =
      error instanceof Error ? error.message : 'Failed to upload model'
    currentStep.value = 3
  } finally {
    isUploading.value = false
  }
}

function goToPreviousStep() {
  if (currentStep.value > 1) {
    currentStep.value = currentStep.value - 1
  }
}

function handleClose() {
  dialogStore.closeDialog({ key: 'upload-model' })
}

onMounted(() => {
  fetchModelTypes()
})
</script>

<style scoped>
.upload-model-dialog {
  width: 90vw;
  max-width: 800px;
  min-height: 400px;
}

@media (min-width: 640px) {
  .upload-model-dialog {
    width: auto;
    min-width: 600px;
  }
}
</style>
