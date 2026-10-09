<script setup lang="ts">
import type { ToastViewportProps } from 'reka-ui'
import { ToastViewport, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { TOAST_Z_INDEX } from '@/components/dialog/vRekaZIndex'

const { class: className, ...restProps } = defineProps<
  ToastViewportProps & { class?: HTMLAttributes['class'] }
>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <ToastViewport v-bind="forwardedProps" as-child>
    <ol
      :style="{ zIndex: TOAST_Z_INDEX }"
      :class="
        cn(
          'pointer-events-none fixed top-20 right-(--workspace-inset-right,0px) m-0 flex max-h-[calc(100dvh-5rem)] w-full max-w-sm flex-col gap-2 overflow-y-auto p-2 supports-[right:anchor(--a_right)]:top-[anchor(--graph-canvas-panel_top,0px)] supports-[right:anchor(--a_right)]:right-[anchor(--graph-canvas-panel_right,anchor(--docked-agent-panel_left,var(--workspace-inset-right,0px)))] [:root:has([data-reka-dialog-content][data-state=open])_&]:top-0',
          className
        )
      "
    />
  </ToastViewport>
</template>
