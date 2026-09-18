<script setup lang="ts">
import type {
  SplitterResizeHandleEmits,
  SplitterResizeHandleProps
} from 'reka-ui'
import { SplitterResizeHandle, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  SplitterResizeHandleProps & { class?: HTMLAttributes['class'] }
>()
const emit = defineEmits<SplitterResizeHandleEmits>()
const forwarded = useForwardPropsEmits(restProps, emit)
</script>

<template>
  <SplitterResizeHandle
    v-bind="forwarded"
    :class="
      cn(
        'relative z-10 flex w-px shrink-0 items-center justify-center bg-border-default outline-none',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
        'hover:bg-primary-background data-[state=drag]:bg-primary-background',
        'focus-visible:ring-ring focus-visible:ring-1',
        'data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full',
        'data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:top-1/2 data-[orientation=vertical]:after:h-1 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2',
        className
      )
    "
  >
    <slot />
  </SplitterResizeHandle>
</template>
