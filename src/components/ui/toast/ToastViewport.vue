<script setup lang="ts">
import type { ToastViewportProps } from 'reka-ui'
import { ToastViewport, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'

const {
  class: className,
  zIndexVersion,
  ...restProps
} = defineProps<
  ToastViewportProps & {
    class?: HTMLAttributes['class']
    zIndexVersion?: number
  }
>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <ToastViewport v-bind="forwardedProps" as-child>
    <ol
      v-reka-z-index="zIndexVersion"
      :class="
        cn(
          'pointer-events-none fixed top-20 right-[calc(1rem+var(--workspace-inset-right,0px))] flex max-h-screen w-full max-w-sm flex-col gap-2 p-4',
          className
        )
      "
    />
  </ToastViewport>
</template>
