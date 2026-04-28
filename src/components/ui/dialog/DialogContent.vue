<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import { DialogContent } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DialogContentVariants } from './dialog.variants'
import { dialogContentVariants } from './dialog.variants'

const {
  size,
  class: customClass = '',
  ...delegated
} = defineProps<
  DialogContentProps & {
    size?: DialogContentVariants['size']
    class?: HTMLAttributes['class']
  }
>()

defineEmits<DialogContentEmits>()
</script>

<template>
  <DialogContent
    v-bind="delegated"
    :class="cn(dialogContentVariants({ size }), customClass)"
  >
    <slot />
  </DialogContent>
</template>
