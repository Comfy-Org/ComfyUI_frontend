<template>
  <div class="flex justify-end gap-2 w-full">
    <IconTextButton
      v-if="currentStep === 1"
      :label="$t('assetBrowser.uploadModelHowDoIFindThis')"
      type="transparent"
      size="md"
      class="mr-auto underline text-muted-foreground"
      data-attr="upload-model-step1-help-link"
      @click="showVideoHelp = true"
    >
      <template #icon>
        <i class="icon-[lucide--circle-question-mark]" />
      </template>
    </IconTextButton>
    <Button
      v-if="currentStep === 1"
      variant="muted-textonly"
      size="lg"
      data-attr="upload-model-step1-cancel-button"
      :disabled="isFetchingMetadata || isUploading"
      @click="emit('close')"
    >
      {{ $t('g.cancel') }}
    </Button>
    <Button
      v-if="currentStep !== 1 && currentStep !== 3"
      variant="muted-textonly"
      size="lg"
      :data-attr="`upload-model-step${currentStep}-back-button`"
      :disabled="isFetchingMetadata || isUploading"
      @click="emit('back')"
    >
      {{ $t('g.back') }}
    </Button>
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
    <Button
      v-else-if="currentStep === 3 && uploadStatus === 'success'"
      variant="secondary"
      data-attr="upload-model-step3-finish-button"
      @click="emit('close')"
    >
      {{ $t('assetBrowser.finish') }}
    </Button>
    <VideoHelpDialog
      v-model="showVideoHelp"
      video-url="https://media.comfy.org/compressed_768/civitai_howto.webm"
      :aria-label="$t('assetBrowser.uploadModelHelpVideo')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import Button from '@/components/ui/button/Button.vue'
import VideoHelpDialog from '@/platform/assets/components/VideoHelpDialog.vue'

const showVideoHelp = ref(false)

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
