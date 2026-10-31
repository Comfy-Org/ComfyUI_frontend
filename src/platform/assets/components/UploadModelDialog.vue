<template>
  <div class="upload-model-dialog flex flex-col gap-6 border-t p-4 pt-6">
    <UploadModelFileUpload
      v-if="fileState.status !== 'idle'"
      v-model="fileModelType"
      :state="fileState"
      :folders="fileUpload.uploadFolders.value"
      @upload="handleUploadFile"
      @cancel="fileUpload.cancel"
      @back="fileUpload.reset"
      @close="handleClose"
    />
    <!-- Scrollable content area -->
    <div v-else class="min-h-0 flex-auto basis-0 overflow-y-auto">
      <!-- Step 1: Enter URL -->
      <UploadModelUrlInput
        v-if="currentStep === 1"
        v-model="wizardData.url"
        :error="uploadError"
      >
        <UploadModelFilePicker
          v-if="canUploadFile"
          :error="fileError"
          @choose="fileUpload.choose"
        />
      </UploadModelUrlInput>

      <!-- Step 2: Confirm Metadata -->
      <UploadModelConfirmation
        v-else-if="currentStep === 2"
        v-model="selectedModelType"
        :metadata="wizardData.metadata"
        :preview-image="wizardData.previewImage"
        :upload-context="uploadContext"
      />

      <!-- Step 3: Upload Progress -->
      <UploadModelProgress
        v-else-if="currentStep === 3 && uploadStatus != null"
        :result="uploadStatus"
        :error="uploadError"
        :type-mismatch="uploadTypeMismatch"
        :metadata="wizardData.metadata"
        :model-type="selectedModelType"
        :preview-image="wizardData.previewImage"
      />
    </div>

    <!-- Navigation Footer - always visible -->
    <UploadModelFooter
      v-if="fileState.status === 'idle'"
      class="shrink-0"
      :current-step="currentStep"
      :is-fetching-metadata="isFetchingMetadata"
      :is-uploading="isUploading"
      :can-fetch-metadata="canFetchMetadata"
      :can-upload-model="canUploadModel"
      :upload-status="uploadStatus"
      :can-import-another="!isMissingModelResolution"
      @back="goToPreviousStep"
      @fetch-metadata="handleFetchMetadata"
      @upload="handleUploadModel"
      @close="handleClose"
      @import-another="resetWizard"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import UploadModelConfirmation from '@/platform/assets/components/UploadModelConfirmation.vue'
import UploadModelFilePicker from '@/platform/workspace/components/UploadModelFilePicker.vue'
import UploadModelFileUpload from '@/platform/workspace/components/UploadModelFileUpload.vue'
import UploadModelFooter from '@/platform/assets/components/UploadModelFooter.vue'
import UploadModelProgress from '@/platform/assets/components/UploadModelProgress.vue'
import UploadModelUrlInput from '@/platform/assets/components/UploadModelUrlInput.vue'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import { useUploadModelFile } from '@/platform/workspace/composables/useUploadModelFile'
import type {
  UploadModelDialogContext,
  UploadModelSuccess
} from '@/platform/assets/composables/useUploadModelWizard'
import { useUploadModelWizard } from '@/platform/assets/composables/useUploadModelWizard'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const fileUpload = useUploadModelFile()
const { state: fileState, modelType: fileModelType } = fileUpload
const { modelTypes, fetchModelTypes } = useModelTypes()

const { uploadContext } = defineProps<{
  uploadContext?: UploadModelDialogContext
}>()

const emit = defineEmits<{
  'upload-success': [result: UploadModelSuccess]
}>()

const isMissingModelResolution = computed(
  () => uploadContext?.kind === 'missing-model-resolution'
)
const requiredModelType = computed(() =>
  uploadContext?.kind === 'missing-model-resolution'
    ? uploadContext.requiredModelType
    : undefined
)

const {
  currentStep,
  isFetchingMetadata,
  isUploading,
  uploadStatus,
  uploadError,
  uploadTypeMismatch,
  wizardData,
  selectedModelType,
  canFetchMetadata,
  canUploadModel,
  fetchMetadata,
  uploadModel,
  goToPreviousStep,
  resetWizard
} = useUploadModelWizard(modelTypes, {
  requiredModelType: requiredModelType.value
})

const fileError = computed(() =>
  fileState.value.status === 'idle' ? fileState.value.error : undefined
)
const canUploadFile = computed(
  () => fileUpload.isAvailable.value && !isMissingModelResolution.value
)

async function handleUploadFile() {
  const result = await fileUpload.upload()
  if (result) {
    emit('upload-success', result)
  }
}

async function handleFetchMetadata() {
  await fetchMetadata()
}

async function handleUploadModel() {
  const result = await uploadModel()
  if (result) {
    emit('upload-success', result)
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
  height: min(400px, 80vh);
  max-height: 100%;
}

@media (min-width: 640px) {
  .upload-model-dialog {
    width: auto;
    min-width: 600px;
  }
}
</style>
