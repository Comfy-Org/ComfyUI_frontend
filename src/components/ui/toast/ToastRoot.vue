<script setup lang="ts">
import type { ToastRootEmits, ToastRootProps } from 'reka-ui'
import { ToastRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  role = 'status',
  ...restProps
} = defineProps<
  ToastRootProps & {
    class?: HTMLAttributes['class']
    role?: 'alert' | 'status'
  }
>()
const emits = defineEmits<ToastRootEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <ToastRoot
    v-bind="forwarded"
    :role
    :class="
      cn(
        'pointer-events-auto relative flex w-full items-start gap-3 rounded-lg border border-border-default bg-base-background p-4 text-base-foreground shadow-lg',
        className
      )
    "
  >
    <slot />
  </ToastRoot>
</template>
