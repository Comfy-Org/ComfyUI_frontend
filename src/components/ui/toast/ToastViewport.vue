<script setup lang="ts">
import type { ToastViewportProps } from 'reka-ui'
import { ToastViewport, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useTemplateRef, watchPostEffect } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ToastId } from '@/types/toastId'
import { raiseModalLayer, releaseModalLayer } from '@/utils/modalLayerStack'

const {
  class: className,
  latestToastId,
  ...restProps
} = defineProps<
  ToastViewportProps & {
    class?: HTMLAttributes['class']
    latestToastId?: ToastId
  }
>()
const forwardedProps = useForwardProps(restProps)
const viewport = useTemplateRef<HTMLOListElement>('viewport')

watchPostEffect((onCleanup) => {
  const element = viewport.value
  if (!element || latestToastId === undefined) return
  raiseModalLayer(element)
  onCleanup(() => releaseModalLayer(element))
})
</script>

<template>
  <ToastViewport v-bind="forwardedProps" as-child>
    <ol
      ref="viewport"
      :class="
        cn(
          'pointer-events-none fixed top-20 right-[calc(1rem+var(--workspace-inset-right,0px))] flex max-h-[calc(100dvh-5rem)] w-full max-w-sm flex-col gap-2 overflow-y-auto p-4',
          className
        )
      "
    />
  </ToastViewport>
</template>
