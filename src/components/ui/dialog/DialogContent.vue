<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import { DialogContent, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DialogContentSize, DialogContentSurface } from './dialog.variants'
import { dialogContentVariants } from './dialog.variants'

const {
  class: customClass = '',
  maximized = false,
  size,
  surface,
  ...restProps
} = defineProps<
  DialogContentProps & {
    class?: HTMLAttributes['class']
    maximized?: boolean
    size?: DialogContentSize
    surface?: DialogContentSurface
  }
>()

const emits = defineEmits<DialogContentEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <DialogContent
    v-bind="forwarded"
    data-reka-dialog-content
    :class="
      cn(
        dialogContentVariants({ maximized, size, surface }),
        customClass,
        // Custom dimension and position classes must yield to maximize.
        maximized &&
          'top-2 left-2 size-auto max-h-none max-w-none sm:max-w-none'
      )
    "
  >
    <slot />
  </DialogContent>
</template>
