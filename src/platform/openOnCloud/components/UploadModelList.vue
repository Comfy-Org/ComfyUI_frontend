<template>
  <ul class="my-0 flex list-none flex-col gap-1.5 p-0">
    <li
      v-for="file in files"
      :key="`${file.model.folder}/${file.model.name}`"
      class="flex flex-col gap-2 rounded-lg bg-secondary px-2.5 py-2 text-xs"
    >
      <div class="flex items-center gap-2">
        <i
          :class="
            cn(
              'size-3.5',
              isUploading && isDone(file)
                ? 'icon-[lucide--circle-check] text-success'
                : 'icon-[lucide--package] text-muted-foreground'
            )
          "
          aria-hidden="true"
        />
        <span class="truncate text-foreground">{{ file.model.name }}</span>
        <span class="shrink-0 text-muted-foreground">
          {{ file.model.folder }}
        </span>
        <span class="ml-auto shrink-0 pl-2 text-muted-foreground">
          {{ fileStatus(file) }}
        </span>
      </div>
      <ProgressBar
        v-if="isUploading && !isDone(file)"
        :percent="(file.uploadedBytes / (file.model.bytes || 1)) * 100"
        class="h-0.5"
      />
    </li>
  </ul>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import ProgressBar from '@/platform/openOnCloud/components/ProgressBar.vue'
import { formatBytes } from '@/platform/openOnCloud/modelUpload'
import type { ModelUploadFile } from '@/platform/openOnCloud/modelUpload'

const { files, isUploading, progressLabel } = defineProps<{
  files: ModelUploadFile[]
  isUploading: boolean
  progressLabel: (done: number, total: number) => string
}>()

const { t, locale } = useI18n()

function isDone(file: ModelUploadFile): boolean {
  return file.uploadedBytes >= (file.model.bytes ?? 0)
}

function fileStatus(file: ModelUploadFile): string {
  if (file.model.bytes === undefined) return ''
  if (!isUploading) return formatBytes(locale.value, file.model.bytes)
  if (isDone(file)) return t('openOnCloud.uploadDialog.uploaded')
  return progressLabel(file.uploadedBytes, file.model.bytes)
}
</script>
