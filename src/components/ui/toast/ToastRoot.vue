<script setup lang="ts">
import type { ToastRootEmits, ToastRootProps } from 'reka-ui'
import { ToastRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  ToastRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<ToastRootEmits>()
const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <ToastRoot
    v-bind="forwarded"
    :class="
      cn(
        'pointer-events-auto relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-lg border border-border-default bg-base-background p-4 text-base-foreground shadow-lg',
        className
      )
    "
  >
    <div class="contents" data-reka-toast-announce-exclude="">
      <slot />
    </div>
  </ToastRoot>
</template>
