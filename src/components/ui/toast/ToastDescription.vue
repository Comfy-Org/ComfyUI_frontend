<script setup lang="ts">
import type { ToastDescriptionProps } from 'reka-ui'
import { ToastDescription, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  ToastDescriptionProps & { class?: HTMLAttributes['class'] }
>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <ToastDescription
    v-bind="forwardedProps"
    :class="cn('mt-1 text-sm text-muted-foreground', className)"
  >
    <slot />
  </ToastDescription>
</template>
