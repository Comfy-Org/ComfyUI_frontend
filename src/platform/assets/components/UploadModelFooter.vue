<template>
  <div class="flex justify-end gap-2 w-full">
    <div
      v-if="currentStep === 1 && flags.huggingfaceModelImportEnabled"
      class="mr-auto flex items-center gap-2"
    >
      <i class="icon-[lucide--circle-question-mark] text-muted-foreground" />
      <TextButton
        :label="$t('assetBrowser.providerCivitai')"
        type="transparent"
        size="sm"
        data-attr="upload-model-step1-help-civitai"
        @click="showCivitaiHelp = true"
      />
      <TextButton
        :label="$t('assetBrowser.providerHuggingFace')"
        type="transparent"
        size="sm"
        data-attr="upload-model-step1-help-huggingface"
        @click="showHuggingFaceHelp = true"
      />
    </div>
    <IconTextButton
      v-else-if="currentStep === 1"
      :label="$t('assetBrowser.uploadModelHowDoIFindThis')"
      type="transparent"
      size="md"
      class="mr-auto underline text-muted-foreground"
      data-attr="upload-model-step1-help-link"
      @click="showCivitaiHelp = true"
    >
      <template #icon>
        <i class="icon-[lucide--circle-question-mark]" />
      </template>
    </IconTextButton>
    <TextButton
      v-if="currentStep === 1"
      :label="$t('g.cancel')"
      type="transparent"
      size="md"
      data-attr="upload-model-step1-cancel-button"
      :disabled="isFetchingMetadata || isUploading"
      @click="emit('close')"
    />
    <TextButton
      v-if="currentStep !== 1 && currentStep !== 3"
      :label="$t('g.back')"
      type="transparent"
      size="md"
      :data-attr="`upload-model-step${currentStep}-back-button`"
      :disabled="isFetchingMetadata || isUploading"
      @click="emit('back')"
    />
    <span v-else />

    <IconTextButton
      v-if="currentStep === 1"
      :label="$t('g.continue')"
      type="secondary"
      size="md"
      data-attr="upload-model-step1-continue-button"
      :disabled="!canFetchMetadata || isFetchingMetadata"
      @click="emit('fetchMetadata')"
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
      type="secondary"
      size="md"
      data-attr="upload-model-step2-confirm-button"
      :disabled="!canUploadModel || isUploading"
      @click="emit('upload')"
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
      type="secondary"
      size="md"
      data-attr="upload-model-step3-finish-button"
      @click="emit('close')"
    />
    <VideoHelpDialog
      v-model="showCivitaiHelp"
      video-url="https://media.comfy.org/compressed_768/civitai_howto.webm"
      :aria-label="$t('assetBrowser.uploadModelHelpVideo')"
    />
    <VideoHelpDialog
      v-model="showHuggingFaceHelp"
      video-url="https://media.comfy.org/byom/huggingfacehowto.mp4"
      :aria-label="$t('assetBrowser.uploadModelHelpVideo')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import TextButton from '@/components/button/TextButton.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import VideoHelpDialog from '@/platform/assets/components/VideoHelpDialog.vue'

const { flags } = useFeatureFlags()

const showCivitaiHelp = ref(false)
const showHuggingFaceHelp = ref(false)

defineProps<{
  currentStep: number
  isFetchingMetadata: boolean
  isUploading: boolean
  canFetchMetadata: boolean
  canUploadModel: boolean
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error'
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'fetchMetadata'): void
  (e: 'upload'): void
  (e: 'close'): void
}>()
</script>
