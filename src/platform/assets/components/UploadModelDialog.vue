<template>
  <div
    class="upload-model-dialog flex flex-col justify-between gap-6 p-4 pt-6 border-t border-border-default"
  >
    <!-- Step 1: Enter URL -->
    <UploadModelUrlInput
      v-if="currentStep === 1 && flags.huggingfaceModelImportEnabled"
      v-model="wizardData.url"
      :error="uploadError"
      class="flex-1"
    />
    <UploadModelUrlInputCivitai
      v-else-if="currentStep === 1"
      v-model="wizardData.url"
      :error="uploadError"
    />

    <!-- Step 2: Confirm Metadata -->
    <UploadModelConfirmation
      v-else-if="currentStep === 2"
      v-model="selectedModelType"
      :metadata="wizardData.metadata"
      :preview-image="wizardData.previewImage"
    />

    <!-- Step 3: Upload Progress -->
    <UploadModelProgress
      v-else-if="currentStep === 3"
      :status="uploadStatus"
      :error="uploadError"
      :metadata="wizardData.metadata"
      :model-type="selectedModelType"
      :preview-image="wizardData.previewImage"
    />

    <!-- Navigation Footer -->
    <UploadModelFooter
      :current-step="currentStep"
      :is-fetching-metadata="isFetchingMetadata"
      :is-uploading="isUploading"
      :can-fetch-metadata="canFetchMetadata"
      :can-upload-model="canUploadModel"
      :upload-status="uploadStatus"
      @back="goToPreviousStep"
      @fetch-metadata="handleFetchMetadata"
      @upload="handleUploadModel"
      @close="handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import UploadModelConfirmation from '@/platform/assets/components/UploadModelConfirmation.vue'
import UploadModelFooter from '@/platform/assets/components/UploadModelFooter.vue'
import UploadModelProgress from '@/platform/assets/components/UploadModelProgress.vue'
import UploadModelUrlInput from '@/platform/assets/components/UploadModelUrlInput.vue'
import UploadModelUrlInputCivitai from '@/platform/assets/components/UploadModelUrlInputCivitai.vue'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import { useUploadModelWizard } from '@/platform/assets/composables/useUploadModelWizard'
import { useDialogStore } from '@/stores/dialogStore'

const { flags } = useFeatureFlags()
const dialogStore = useDialogStore()
const { modelTypes, fetchModelTypes } = useModelTypes()

const emit = defineEmits<{
  'upload-success': []
}>()

const {
  currentStep,
  isFetchingMetadata,
  isUploading,
  uploadStatus,
  uploadError,
  wizardData,
  selectedModelType,
  canFetchMetadata,
  canUploadModel,
  fetchMetadata,
  uploadModel,
  goToPreviousStep
} = useUploadModelWizard(modelTypes)

async function handleFetchMetadata() {
  console.log('fetching')
  console.log('uploadError before fetch:', uploadError.value)
  await fetchMetadata()
  console.log('uploadError after fetch:', uploadError.value)
}

async function handleUploadModel() {
  const success = await uploadModel()
  if (success) {
    emit('upload-success')
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
