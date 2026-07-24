<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import {
  DialogContent,
  injectDialogRootContext,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DialogContentSize } from './dialog.variants'
import { dialogContentVariants } from './dialog.variants'
import { useModalPointerLock } from './useModalPointerLock'

const {
  size,
  maximized = false,
  class: customClass = '',
  ...restProps
} = defineProps<
  DialogContentProps & {
    size?: DialogContentSize
    maximized?: boolean
    class?: HTMLAttributes['class']
  }
>()

const emits = defineEmits<DialogContentEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)

const dialogRootContext = injectDialogRootContext(null)
if (dialogRootContext?.modal.value) {
  useModalPointerLock(() => dialogRootContext.open.value)
}
</script>

<template>
  <DialogContent
    v-bind="forwarded"
    :class="
      cn(
        dialogContentVariants({ size, maximized }),
        customClass,
        // Custom dimension classes must yield to maximize, mirroring the
        // PrimeVue `.p-dialog-maximized` !important behavior.
        maximized && 'size-auto max-h-none max-w-none sm:max-w-none'
      )
    "
  >
    <slot />
  </DialogContent>
</template>
