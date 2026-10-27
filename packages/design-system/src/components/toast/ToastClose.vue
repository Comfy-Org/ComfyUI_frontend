<script setup lang="ts">
import type { ToastCloseProps } from 'reka-ui'
import { ToastClose, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'

const { class: className, ...restProps } = defineProps<
  ToastCloseProps & { class?: HTMLAttributes['class'] }
>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <ToastClose v-bind="forwardedProps" as-child>
    <Button
      variant="muted-textonly"
      size="icon-sm"
      :class="cn('ml-auto', className)"
    >
      <i class="icon-[lucide--x]" aria-hidden="true" />
    </Button>
  </ToastClose>
</template>
