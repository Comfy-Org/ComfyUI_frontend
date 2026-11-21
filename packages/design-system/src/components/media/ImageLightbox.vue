<script setup lang="ts">
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import {
  DialogDescription,
  DialogRoot,
  DialogTitle,
  VisuallyHidden
} from 'reka-ui'

import Button from '@comfyorg/design-system/button/Button'

const open = defineModel<boolean>({ default: false })

const {
  src,
  alt = '',
  fallbackTitle,
  closeLabel
} = defineProps<{
  src: string
  alt?: string
  fallbackTitle: string
  closeLabel: string
}>()
</script>
<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent surface="none" size="fit">
        <VisuallyHidden>
          <DialogTitle>{{ alt || fallbackTitle }}</DialogTitle>
          <DialogDescription v-if="alt">{{ alt }}</DialogDescription>
        </VisuallyHidden>
        <DialogClose>
          <Button
            :aria-label="closeLabel"
            size="icon"
            variant="muted-textonly"
            class="absolute -top-2 -right-2 z-10 translate-x-full text-white hover:text-white/80"
          >
            <i class="icon-[lucide--x] size-5" />
          </Button>
        </DialogClose>
        <img
          :src
          :alt
          class="max-h-[90vh] max-w-[90vw] rounded-sm object-contain"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
