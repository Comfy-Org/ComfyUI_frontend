<script setup lang="ts">
import type { DialogOverlayProps } from 'reka-ui'
import { DialogOverlay } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: customClass = '', ...delegated } = defineProps<
  DialogOverlayProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <DialogOverlay
    v-bind="delegated"
    data-slot="dialog-overlay"
    data-testid="dialog-overlay"
    :class="
      cn(
        'fixed inset-0 z-overlay bg-black/70 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        customClass
      )
    "
  />
</template>
