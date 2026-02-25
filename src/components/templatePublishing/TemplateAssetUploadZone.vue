<!--
  Reusable upload zone for a single file asset. Shows a dashed click-to-upload
  area when empty, and a preview with filename overlay when populated.
  Optionally displays an upload progress bar underneath.
-->
<template>
  <div>
    <div
      v-if="!asset"
      :class="
        cn(
          'flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border-default hover:border-muted-foreground',
          sizeClass
        )
      "
      role="button"
      :tabindex="0"
      :aria-label="t('templatePublishing.steps.previewGeneration.uploadPrompt')"
      @click="fileInput?.click()"
      @keydown.enter="fileInput?.click()"
    >
      <div class="flex flex-col items-center gap-1 text-muted-foreground">
        <i class="icon-[lucide--upload] h-5 w-5" />
        <span class="text-xs">
          {{ t('templatePublishing.steps.previewGeneration.uploadPrompt') }}
        </span>
      </div>
    </div>

    <div
      v-else
      :class="cn('group relative overflow-hidden rounded-lg', sizeClass)"
    >
      <img
        v-if="previewType === 'image'"
        :src="asset.objectUrl"
        :alt="asset.originalName"
        class="h-full w-full object-cover"
      />
      <video
        v-else
        :src="asset.objectUrl"
        controls
        class="h-full w-full object-cover"
      />
      <div
        class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <span class="truncate text-xs text-white">
          {{ asset.originalName }}
        </span>
        <button
          type="button"
          class="shrink-0 text-white hover:text-danger"
          :aria-label="
            t('templatePublishing.steps.previewGeneration.removeFile')
          "
          @click="emit('remove')"
        >
          <i class="icon-[lucide--x] h-4 w-4" />
        </button>
      </div>
    </div>

    <div
      v-if="uploadProgress && !uploadProgress.complete"
      class="mt-1 flex flex-col gap-0.5"
    >
      <progress
        :value="uploadProgress.percent"
        max="100"
        :aria-label="
          t('templatePublishing.steps.previewGeneration.uploadingProgress', {
            percent: uploadProgress.percent
          })
        "
        class="h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-150 [&::-webkit-progress-value]:ease-out"
      />
      <span class="text-[10px] text-muted-foreground">
        {{ uploadProgress.percent }}%
      </span>
    </div>

    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      class="hidden"
      @change="onFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UploadProgress } from '@/composables/useAssetUploadProgress'
import type { CachedAsset } from '@/types/templateMarketplace'
import { cn } from '@/utils/tailwindUtil'

const {
  asset = null,
  accept = 'image/*',
  previewType = 'image',
  sizeClass = 'h-32 w-48',
  uploadProgress
} = defineProps<{
  asset?: CachedAsset | null
  accept?: string
  previewType?: 'image' | 'video'
  sizeClass?: string
  /** Reactive upload progress. Progress bar is shown only while uploading. */
  uploadProgress?: UploadProgress
}>()

const emit = defineEmits<{
  upload: [file: File]
  remove: []
}>()

const { t } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)

function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('upload', file)
    input.value = ''
  }
}
</script>
