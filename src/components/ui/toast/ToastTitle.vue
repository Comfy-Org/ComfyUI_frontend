<script setup lang="ts">
import type { ToastTitleProps } from 'reka-ui'
import { ToastTitle, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  ToastTitleProps & { class?: HTMLAttributes['class'] }
>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <ToastTitle
    v-bind="forwardedProps"
    :class="cn('text-sm font-medium', className)"
  >
    <slot />
  </ToastTitle>
</template>
