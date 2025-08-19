<template>
  <Button unstyled :class="buttonStyle" @click="onClick">
    <slot></slot>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import type { BaseButtonProps } from '@/types/buttonTypes'
import {
  getBaseButtonClasses,
  getButtonTypeClasses,
  getIconButtonSizeClasses
} from '@/types/buttonTypes'

interface IconButtonProps extends BaseButtonProps {
  onClick: (event: Event) => void
}

const {
  size = 'md',
  type = 'secondary',
  class: className,
  onClick
} = defineProps<IconButtonProps>()

const buttonStyle = computed(() => {
  const baseClasses = `${getBaseButtonClasses()} p-0`
  const sizeClasses = getIconButtonSizeClasses(size)
  const typeClasses = getButtonTypeClasses(type)

  return [baseClasses, sizeClasses, typeClasses, className]
    .filter(Boolean)
    .join(' ')
})
</script>
