<script setup lang="ts">
import { DialogRoot, DialogTitle } from 'reka-ui'

import DialogContent from '@/components/ui/DialogContent.vue'

const {
  url,
  filename,
  isVideo = false
} = defineProps<{
  url?: string
  filename?: string
  isVideo?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogContent class="max-w-3xl border-0 bg-transparent p-0 shadow-none">
      <DialogTitle class="sr-only">{{ filename }}</DialogTitle>
      <video
        v-if="isVideo && url"
        :src="url"
        class="rounded-agent max-h-[80vh] w-full object-contain"
        controls
        autoplay
        loop
      />
      <img
        v-else-if="url"
        :src="url"
        :alt="filename"
        class="rounded-agent max-h-[80vh] w-full object-contain"
      />
    </DialogContent>
  </DialogRoot>
</template>
