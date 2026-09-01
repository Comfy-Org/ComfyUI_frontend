<script setup lang="ts">
import type { DialogOverlayProps } from 'reka-ui'
import { DialogOverlay, Presence, injectDialogRootContext } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: customClass = '', ...delegated } = defineProps<
  DialogOverlayProps & { class?: HTMLAttributes['class'] }
>()

// Reka renders DialogOverlay only for modal dialogs; non-modal dialogs still
// need the scrim, so render a plain backdrop for them.
const rootContext = injectDialogRootContext()

const overlayClass =
  'fixed inset-0 z-1700 bg-black/70 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'
</script>

<template>
  <DialogOverlay
    v-if="rootContext.modal.value"
    v-bind="delegated"
    data-testid="dialog-overlay"
    :class="cn(overlayClass, customClass)"
  />
  <Presence v-else :present="delegated.forceMount || rootContext.open.value">
    <div
      :data-state="rootContext.open.value ? 'open' : 'closed'"
      data-testid="dialog-overlay"
      :class="cn(overlayClass, customClass)"
    />
  </Presence>
</template>
