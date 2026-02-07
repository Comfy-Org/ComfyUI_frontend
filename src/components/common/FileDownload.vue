<!-- A file download button with a label and a size hint -->
<template>
  <div class="flex flex-row items-center gap-2">
    <div>
      <div>
        <span :title="displayHint">{{ displayLabel }}</span>
      </div>
      <Message
        v-if="error"
        severity="error"
        icon="pi pi-exclamation-triangle"
        size="small"
        variant="outlined"
        class="my-2 h-min max-w-xs px-1"
        :title="error"
        :pt="{
          text: { class: 'overflow-hidden text-ellipsis' }
        }"
      >
        {{ error }}
      </Message>
    </div>
    <div>
      <Button
        variant="secondary"
        :disabled="!!error"
        :title="url"
        @click="download.triggerBrowserDownload"
      >
        {{ $t('g.downloadWithSize', { size: fileSize }) }}
      </Button>
    </div>
    <div>
      <Button variant="secondary" :disabled="!!error" @click="copyURL">
        {{ $t('g.copyURL') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useDownload } from '@/composables/useDownload'
import { formatSize } from '@/utils/formatUtil'

const { url, hint, label, error } = defineProps<{
  url: string
  hint?: string
  label?: string
  error?: string
}>()

const displayLabel = computed(() => label || url.split('/').pop())

const displayHint = computed(() => hint || url)
const download = useDownload(url)
const fileSize = computed(() =>
  download.fileSize.value ? formatSize(download.fileSize.value) : '?'
)
const copyURL = async () => {
  await copyToClipboard(url)
}

const { copyToClipboard } = useCopyToClipboard()
</script>
