<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

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

const { t } = useI18n()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/60" />
      <DialogContent
        class="agent-scope text-agent-fg fixed top-1/2 left-1/2 z-50 w-full max-w-3xl -translate-1/2 focus:outline-none"
      >
        <DialogTitle class="sr-only">{{ filename }}</DialogTitle>
        <video
          v-if="isVideo && url"
          :src="url"
          class="rounded-agent max-h-[80vh] w-full object-contain"
          controls
          autoplay
          muted
          playsinline
          loop
        />
        <img
          v-else-if="url"
          :src="url"
          :alt="filename"
          class="rounded-agent max-h-[80vh] w-full object-contain"
        />
        <DialogClose
          class="rounded-agent text-agent-fg-subtle hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent absolute top-3 right-3 flex size-7 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
          :aria-label="t('agent.close')"
        >
          <span class="icon-[lucide--x] size-4" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
