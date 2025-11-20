<template>
  <div class="flex justify-end gap-2">
    <TextButton
      v-if="currentStep !== 1 && currentStep !== 3"
      :label="$t('g.back')"
      type="secondary"
      size="md"
      :disabled="isFetchingMetadata || isUploading"
      @click="emit('back')"
    />
    <span v-else />

    <IconTextButton
      v-if="currentStep === 1"
      :label="$t('g.continue')"
      type="primary"
      size="md"
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
      type="primary"
      size="md"
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
      type="primary"
      size="md"
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
