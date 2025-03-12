<!-- A file download button with a label and a size hint -->
<template>
  <div class="flex flex-row items-center gap-2">
    <div>
      <div>
        <span :title="hint">{{ label }}</span>
      </div>
      <Message
        v-if="props.error"
        severity="error"
        icon="pi pi-exclamation-triangle"
        size="small"
        variant="outlined"
        class="h-min my-2 px-1 max-w-xs"
        :title="props.error"
        :pt="{
          text: { class: 'overflow-hidden text-ellipsis' }
        }"
      >
        {{ props.error }}
      </Message>
    </div>
    <div>
      <Button
        :label="$t('g.download') + ' (' + fileSize + ')'"
        size="small"
        outlined
        :disabled="!!props.error"
        :title="props.url"
        @click="download.triggerBrowserDownload"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { computed } from 'vue'

import { useDownload } from '@/composables/useDownload'
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
