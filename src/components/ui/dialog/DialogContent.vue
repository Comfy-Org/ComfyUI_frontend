<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import { DialogContent, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DialogContentSize } from './dialog.variants'
import { dialogContentVariants } from './dialog.variants'

const {
  size,
  class: customClass = '',
  ...restProps
} = defineProps<
  DialogContentProps & {
    size?: DialogContentSize
    class?: HTMLAttributes['class']
  }
>()

const emits = defineEmits<DialogContentEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <DialogContent
    v-bind="forwarded"
    :class="cn(dialogContentVariants({ size }), customClass)"
  >
    <slot />
  </DialogContent>
</template>
