<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  VisuallyHidden
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const open = defineModel<boolean>({ default: false })

const { src, alt = '' } = defineProps<{
  src: string
  alt?: string
}>()

const isVideo = computed(() => {
  const videoExt = /\.(mp4|webm|mov)/i
  return (
    videoExt.test(src) ||
    videoExt.test(
      new URL(src, location.href).searchParams.get('filename') ?? ''
    )
  )
})

const { t } = useI18n()
</script>
<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-30 bg-black/60 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-1700 -translate-1/2 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-50"
        @escape-key-down="open = false"
      >
        <VisuallyHidden>
          <DialogTitle>{{ alt || t('g.imageLightbox') }}</DialogTitle>
          <DialogDescription v-if="alt">{{ alt }}</DialogDescription>
        </VisuallyHidden>
        <DialogClose as-child>
          <Button
            :aria-label="t('g.close')"
            size="icon"
            variant="muted-textonly"
            class="absolute -top-2 -right-2 z-10 translate-x-full text-white hover:text-white/80"
          >
            <i class="icon-[lucide--x] size-5" />
          </Button>
        </DialogClose>
        <video
          v-if="isVideo"
          :src
          controls
          autoplay
          class="max-h-[90vh] max-w-[90vw] rounded-sm object-contain"
        />
        <img
          v-else
          :src
          :alt
          class="max-h-[90vh] max-w-[90vw] rounded-sm object-contain"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
