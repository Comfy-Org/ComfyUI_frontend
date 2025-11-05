<template>
  <div class="upload-model-dialog flex flex-col justify-between gap-6 p-4 pt-6">
    <!-- Step 1: Enter URL -->
    <UploadModelUrlInput v-if="currentStep === 1" v-model="wizardData.url" />

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
    <div class="flex justify-end gap-2">
      <TextButton
        v-if="currentStep !== 1 && currentStep !== 3"
        :label="$t('g.back')"
        type="secondary"
        size="md"
        :disabled="isFetchingMetadata || isUploading"
        :on-click="goToPreviousStep"
      />
      <span v-else />

      <IconTextButton
        v-if="currentStep === 1"
        :label="$t('g.continue')"
        type="primary"
        size="md"
        :disabled="!canFetchMetadata || isFetchingMetadata"
        :on-click="handleFetchMetadata"
      >
        <template #icon>
          <i
            v-if="isFetchingMetadata"
            class="icon-[lucide--loader-circle] animate-spin"
          />
        </template>
      </IconTextButton>
      <IconTextButton
        v-else-if="currentStep === 2"
        :label="$t('assetBrowser.upload')"
        type="primary"
        size="md"
        :disabled="!canUploadModel || isUploading"
        :on-click="handleUploadModel"
      >
        <template #icon>
          <i
            v-if="isUploading"
            class="icon-[lucide--loader-circle] animate-spin"
          />
        </template>
      </IconTextButton>
      <TextButton
        v-else-if="currentStep === 3 && uploadStatus === 'success'"
        :label="$t('assetBrowser.finish')"
        type="primary"
        size="md"
        :on-click="handleClose"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import TextButton from '@/components/button/TextButton.vue'
import UploadModelConfirmation from '@/platform/assets/components/UploadModelConfirmation.vue'
import UploadModelProgress from '@/platform/assets/components/UploadModelProgress.vue'
import UploadModelUrlInput from '@/platform/assets/components/UploadModelUrlInput.vue'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
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
  metadata: {
    content_length: number
    final_url: string
    content_type?: string
    filename?: string
    name?: string
    tags?: string[]
    preview_url?: string
  } | null
  name: string
  tags: string[]
}>({
  url: '',
  metadata: null,
  name: '',
  tags: []
})

const selectedModelType = ref<string>('loras')

const { modelTypes, fetchModelTypes } = useModelTypes()

// Validation
const canFetchMetadata = computed(() => {
  return wizardData.value.url.trim().length > 0
})

const canUploadModel = computed(() => {
  return !!selectedModelType.value
})

async function handleFetchMetadata() {
  if (!canFetchMetadata.value) return

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
      error instanceof Error ? error.message : 'Failed to retrieve metadata'
    // TODO: Show error toast to user
  } finally {
    isFetchingMetadata.value = false
  }
}

async function handleUploadModel() {
  if (!canUploadModel.value) return

  isUploading.value = true
  uploadStatus.value = 'uploading'

  try {
    const tags = ['models', selectedModelType.value]
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
  min-width: 600px;
  min-height: 400px;
}
</style>
