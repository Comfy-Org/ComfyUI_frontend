<template>
  <div class="flex justify-end gap-2 w-full">
    <span
      v-if="currentStep === 1"
      class="text-muted-foreground mr-auto underline flex items-center gap-2"
    >
      <i class="icon-[lucide--circle-question-mark]" />
      <a
        href="#"
        target="_blank"
        class="text-muted-foreground"
        data-attr="upload-model-step1-help-link"
        >{{ $t('How do I find this?') }}</a
      >
    </span>
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
  </div>
</template>

<script setup lang="ts">
import IconTextButton from '@/components/button/IconTextButton.vue'
import TextButton from '@/components/button/TextButton.vue'

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
