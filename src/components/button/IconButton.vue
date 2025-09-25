<template>
  <Button
    v-bind="$attrs"
    unstyled
    :class="buttonStyle"
    :disabled="disabled"
    @click="onClick"
  >
    <slot></slot>
  </Button>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import Button from 'primevue/button'
import { computed } from 'vue'

import type { BaseButtonProps } from '@/types/buttonTypes'
import {
  getBaseButtonClasses,
  getBorderButtonTypeClasses,
  getButtonTypeClasses,
  getIconButtonSizeClasses
} from '@/types/buttonTypes'

interface IconButtonProps extends BaseButtonProps {
  onClick: (event: Event) => void
}

defineOptions({
  inheritAttrs: false
})

const {
  size = 'md',
  type = 'secondary',
  border = false,
  disabled = false,
  class: className,
  onClick
} = defineProps<IconButtonProps>()

const buttonStyle = computed(() => {
  const baseClasses = `${getBaseButtonClasses()} p-0`
  const sizeClasses = getIconButtonSizeClasses(size)
  const typeClasses = border
    ? getBorderButtonTypeClasses(type)
    : getButtonTypeClasses(type)

  return cn(baseClasses, sizeClasses, typeClasses, className)
})
</script>
