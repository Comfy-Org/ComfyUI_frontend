<script setup lang="ts">
import type { ToastViewportProps } from 'reka-ui'
import { ToastViewport, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  ToastViewportProps & { class?: HTMLAttributes['class'] }
>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <ToastViewport
    v-bind="forwardedProps"
    :class="
      cn(
        'pointer-events-none fixed top-20 right-4 z-1100 flex max-h-screen w-full max-w-sm flex-col gap-2 p-4',
        className
      )
    "
  />
</template>
