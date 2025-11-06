<template>
  <div class="upload-model-dialog flex flex-col p-8">
    <Stepper v-model:value="currentStep" class="flex flex-col gap-6">
      <StepPanels>
        <!-- Step 1: Enter URL -->
        <StepPanel value="1">
          <div class="flex flex-col gap-6">
            <div class="flex flex-col gap-2">
              <p class="text-base">
                {{ $t('assetBrowser.uploadModelDescription1') }}
              </p>
              <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
                <li>{{ $t('assetBrowser.uploadModelDescription2') }}</li>
                <li>{{ $t('assetBrowser.uploadModelDescription3') }}</li>
              </ul>
            </div>

            <div class="flex flex-col gap-2">
              <label for="civitai-link" class="font-medium">
                {{ $t('assetBrowser.civitaiLinkLabel') }}
              </label>
              <InputText
                id="civitai-link"
                v-model="wizardData.url"
                :placeholder="$t('assetBrowser.civitaiLinkPlaceholder')"
                class="w-full"
              />
              <small class="text-muted">
                {{ $t('assetBrowser.civitaiLinkExample') }}
              </small>
            </div>
          </div>
        </StepPanel>

        <!-- Step 2: Confirm Metadata -->
        <StepPanel value="2">
          <div class="flex flex-col gap-6">
            <!-- Model Info Section -->
            <div class="flex flex-col gap-4">
              <p class="text-sm text-muted">
                {{ $t('assetBrowser.modelAssociatedWithLink') }}
              </p>

              <div
                class="flex items-center gap-3 rounded-lg bg-surface-hover p-4"
              >
                <img
                  v-if="wizardData.metadata?.preview_url"
                  :src="wizardData.metadata.preview_url"
                  :alt="wizardData.metadata?.name"
                  class="size-16 rounded object-cover"
                />
                <div
                  v-else
                  class="flex size-16 items-center justify-center rounded bg-surface"
                >
                  <i class="icon-[lucide--image] text-2xl text-muted" />
                </div>
                <div class="flex-1">
                  <p class="text-base font-medium">
                    {{ wizardData.metadata?.name || wizardData.metadata?.filename }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Model Type Selection -->
            <div class="flex flex-col gap-2">
              <label for="model-type" class="text-sm text-muted">
                {{ $t('assetBrowser.whatTypeOfModel') }}
              </label>
              <Select
                id="model-type"
                v-model="selectedModelType"
                :options="modelTypeOptions"
                option-label="label"
                option-value="value"
                :placeholder="$t('assetBrowser.selectModelType')"
                class="w-full"
              />
              <div class="flex items-center gap-2 text-sm text-muted">
                <i class="icon-[lucide--info]" />
                <span>{{ $t('assetBrowser.notSureLeaveAsIs') }}</span>
              </div>
            </div>
          </div>
        </StepPanel>

        <!-- Step 3: Upload Progress -->
        <StepPanel value="3">
          <div class="flex flex-col gap-6">
            <!-- Uploading State -->
            <div
              v-if="uploadStatus === 'uploading'"
              class="flex flex-col items-center justify-center gap-6 py-8"
            >
              <i
                class="icon-[lucide--loader-circle] animate-spin text-6xl text-primary"
              />
              <div class="text-center">
                <h3 class="mb-2 text-lg font-semibold">
                  {{ uploadStatusMessage }}
                </h3>
              </div>
            </div>

            <!-- Success State -->
            <div v-else-if="uploadStatus === 'success'" class="flex flex-col gap-6">
              <div class="flex items-start gap-2">
                <h3 class="text-lg font-semibold">
                  {{ $t('assetBrowser.modelUploaded') }}
                </h3>
                <span class="text-lg">🎉</span>
              </div>

              <p class="text-sm text-muted">
                {{ $t('assetBrowser.findInLibrary', { type: selectedModelType.toUpperCase() }) }}
              </p>

              <div
                class="flex items-center gap-3 rounded-lg bg-surface-hover p-4"
              >
                <img
                  v-if="wizardData.metadata?.preview_url"
                  :src="wizardData.metadata.preview_url"
                  :alt="wizardData.metadata?.name"
                  class="size-16 rounded object-cover"
                />
                <div
                  v-else
                  class="flex size-16 items-center justify-center rounded bg-surface"
                >
                  <i class="icon-[lucide--image] text-2xl text-muted" />
                </div>
                <div class="flex flex-col gap-1">
                  <p class="text-base font-medium">
                    {{ wizardData.metadata?.name || wizardData.metadata?.filename }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ selectedModelType.toUpperCase() }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Error State -->
            <div
              v-else-if="uploadStatus === 'error'"
              class="flex flex-col items-center justify-center gap-6 py-8"
            >
              <i class="icon-[lucide--x-circle] text-6xl text-red-500" />
              <div class="text-center">
                <h3 class="mb-2 text-lg font-semibold">
                  {{ uploadStatusMessage }}
                </h3>
                <p v-if="uploadError" class="text-sm text-muted">
                  {{ uploadError }}
                </p>
              </div>
            </div>
          </div>
        </StepPanel>
      </StepPanels>

      <!-- Navigation Footer -->
      <div class="flex justify-between pt-4">
        <Button
          v-if="currentStep !== '1'"
          :label="$t('g.back')"
          severity="secondary"
          :disabled="isFetchingMetadata || isUploading"
          @click="goToPreviousStep"
        />
        <span v-else />

        <Button
          v-if="currentStep === '1'"
          :label="$t('g.continue')"
          severity="primary"
          :disabled="!canProceedStep1"
          :loading="isFetchingMetadata"
          @click="handleStep1Continue"
        />
        <Button
          v-else-if="currentStep === '2'"
          :label="$t('assetBrowser.upload')"
          severity="primary"
          :disabled="!canProceedStep2"
          :loading="isUploading"
          @click="handleStep2Upload"
        />
        <Button
          v-else-if="currentStep === '3' && uploadStatus === 'success'"
          :label="$t('assetBrowser.finish')"
          severity="primary"
          @click="handleClose"
        />
      </div>
    </Stepper>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { assetService } from '@/platform/assets/services/assetService'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()
const dialogStore = useDialogStore()

const currentStep = ref('1')
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
  { label: 'LoRA', value: 'lora' },
  { label: 'Checkpoint', value: 'checkpoint' },
  { label: 'Embedding', value: 'embedding' },
  { label: 'VAE', value: 'vae' },
  { label: 'Upscale Model', value: 'upscale_model' },
  { label: 'ControlNet', value: 'controlnet' }
]

// Step 1 validation
const canProceedStep1 = computed(() => {
  return wizardData.value.url.trim().length > 0
})

// Step 2 validation
const canProceedStep2 = computed(() => {
  return !!selectedModelType.value
})

const uploadStatusMessage = computed(() => {
  switch (uploadStatus.value) {
    case 'uploading':
      return t('assetBrowser.uploadingModel')
    case 'success':
      return t('assetBrowser.uploadSuccess')
    case 'error':
      return t('assetBrowser.uploadFailed')
    default:
      return ''
  }
})

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes === -1) return 'Unknown'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb.toFixed(2)} MB`
}

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
        modelTypeOptions.some(opt => opt.value === tag)
      )
      if (typeTag) {
        selectedModelType.value = typeTag
      }
    }

    currentStep.value = '2'
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
    currentStep.value = '3'
  } catch (error) {
    console.error('Failed to upload asset:', error)
    uploadStatus.value = 'error'
    uploadError.value = error instanceof Error ? error.message : 'Failed to upload model'
    currentStep.value = '3'
  } finally {
    isUploading.value = false
  }
}

function goToPreviousStep() {
  const currentStepNum = parseInt(currentStep.value)
  if (currentStepNum > 1) {
    currentStep.value = (currentStepNum - 1).toString()
  }
}

function handleClose() {
  dialogStore.closeDialog('upload-model')
}
</script>

<style scoped>
.upload-model-dialog {
  min-width: 600px;
  min-height: 400px;
}
</style>
