<template>
  <div class="upload-model-dialog flex flex-col justify-between gap-6 p-4">
    <!-- Step 1: Enter URL -->
    <UploadModelUrlInput
      v-if="currentStep === 1"
      v-model="wizardData.url"
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
    <div class="flex justify-end gap-2">
      <button
        v-if="currentStep !== 1 && currentStep !== 3"
        type="button"
        :class="getButtonClasses('secondary')"
        :disabled="isFetchingMetadata || isUploading"
        @click="goToPreviousStep"
      >
        {{ $t('g.back') }}
      </button>
      <span v-else />

      <button
        v-if="currentStep === 1"
        type="button"
        :class="getButtonClasses('primary')"
        :disabled="!canProceedStep1 || isFetchingMetadata"
        @click="handleStep1Continue"
      >
        <i
          v-if="isFetchingMetadata"
          class="icon-[lucide--loader-circle] mr-2 animate-spin"
        />
        {{ $t('g.continue') }}
      </button>
      <button
        v-else-if="currentStep === 2"
        type="button"
        :class="getButtonClasses('primary')"
        :disabled="!canProceedStep2 || isUploading"
        @click="handleStep2Upload"
      >
        <i
          v-if="isUploading"
          class="icon-[lucide--loader-circle] mr-2 animate-spin"
        />
        {{ $t('assetBrowser.upload') }}
      </button>
      <button
        v-else-if="currentStep === 3 && uploadStatus === 'success'"
        type="button"
        :class="getButtonClasses('primary')"
        @click="handleClose"
      >
        {{ $t('assetBrowser.finish') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { assetService } from '@/platform/assets/services/assetService'
import UploadModelConfirmation from '@/platform/assets/components/UploadModelConfirmation.vue'
import UploadModelProgress from '@/platform/assets/components/UploadModelProgress.vue'
import UploadModelUrlInput from '@/platform/assets/components/UploadModelUrlInput.vue'
import { useDialogStore } from '@/stores/dialogStore'
import {
  getBaseButtonClasses,
  getButtonSizeClasses,
  getButtonTypeClasses
} from '@/types/buttonTypes'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
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

const selectedModelType = ref<string>('lora')

const modelTypeOptions = [
  'lora',
  'checkpoint',
  'embedding',
  'vae',
  'upscale_model',
  'controlnet'
]

// Button styling helper
function getButtonClasses(type: 'primary' | 'secondary') {
  return cn(
    getBaseButtonClasses(),
    getButtonSizeClasses('md'),
    getButtonTypeClasses(type)
  )
}

// Step 1 validation
const canProceedStep1 = computed(() => {
  return wizardData.value.url.trim().length > 0
})

// Step 2 validation
const canProceedStep2 = computed(() => {
  return !!selectedModelType.value
})

async function handleStep1Continue() {
  if (!canProceedStep1.value) return

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
      const typeTag = metadata.tags.find(tag =>
        modelTypeOptions.includes(tag)
      )
      if (typeTag) {
        selectedModelType.value = typeTag
      }
    }

    currentStep.value = 2
  } catch (error) {
    console.error('Failed to retrieve metadata:', error)
    uploadError.value = error instanceof Error ? error.message : 'Failed to retrieve metadata'
    // TODO: Show error toast to user
  } finally {
    isFetchingMetadata.value = false
  }
}

async function handleStep2Upload() {
  if (!canProceedStep2.value) return

  isUploading.value = true
  uploadStatus.value = 'uploading'

  try {
    const tags = ['models', selectedModelType.value]
    const filename = wizardData.value.metadata?.filename || wizardData.value.metadata?.name || 'model'

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
    uploadError.value = error instanceof Error ? error.message : 'Failed to upload model'
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
</script>

<style scoped>
.upload-model-dialog {
  min-width: 600px;
  min-height: 400px;
}
</style>
