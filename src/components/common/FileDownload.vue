<!-- A file download button with a label and a size hint -->
<template>
  <div class="flex flex-row items-center gap-2">
    <div class="file-info">
      <div class="file-details">
        <span class="file-type" :title="hint">{{ label }}</span>
      </div>
      <div v-if="props.error" class="file-error">
        {{ props.error }}
      </div>
    </div>
    <div class="file-action">
      <Button
        class="file-action-button"
        :label="$t('download') + ' (' + fileSize + ')'"
        size="small"
        outlined
        :disabled="props.error"
        :title="props.url"
        @click="download.triggerBrowserDownload"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDownload } from '@/hooks/downloadHooks'
import Button from 'primevue/button'
import { computed } from 'vue'
import { formatSize } from '@/utils/formatUtil'

const props = defineProps<{
  url: string
  hint?: string
  label?: string
  error?: string
}>()

const label = computed(() => props.label || props.url.split('/').pop())
const hint = computed(() => props.hint || props.url)
const download = useDownload(props.url)
const fileSize = computed(() =>
  download.fileSize.value ? formatSize(download.fileSize.value) : '?'
)
</script>
