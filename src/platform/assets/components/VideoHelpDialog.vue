<template>
  <Dialog v-model:open="isVisible">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent
        size="full"
        class="w-[90vw] border-0 bg-transparent p-0 shadow-none"
        :aria-label="ariaLabel"
        @escape-key-down="onEscapeKeyDown"
      >
        <VisuallyHidden as-child>
          <DialogTitle>{{ ariaLabel }}</DialogTitle>
        </VisuallyHidden>
        <div class="relative">
          <Button
            variant="textonly"
            size="icon"
            class="absolute top-4 right-6 z-10"
            :aria-label="$t('g.close')"
            @click="isVisible = false"
          >
            <i class="icon-[lucide--x] size-3.5" />
          </Button>
          <video
            autoplay
            muted
            loop
            :aria-label="ariaLabel"
            class="w-full rounded-lg"
            :src="videoUrl"
          >
            {{ $t('g.videoFailedToLoad') }}
          </video>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { VisuallyHidden } from 'reka-ui'

import Button from '@comfyorg/design-system/button/Button'
import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'

const isVisible = defineModel<boolean>({ required: true })

const { videoUrl, ariaLabel = 'Help video' } = defineProps<{
  videoUrl: string
  ariaLabel?: string
}>()

// The dialog mounts inside other dialogs (e.g. UploadModelFooter inside an
// asset modal). Reka's Escape handling bubbles to the parent dialog and would
// close it as well. Stop propagation so only this dialog closes, and prevent
// Reka's default auto-dismiss so the close path stays solely under the model.
function onEscapeKeyDown(event: KeyboardEvent) {
  event.preventDefault()
  event.stopPropagation()
  isVisible.value = false
}
</script>
