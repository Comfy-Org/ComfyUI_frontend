<template>
  <Button
    v-bind="$attrs"
    unstyled
    :class="buttonStyle"
    :disabled="disabled"
    @click="onClick"
  >
    <span>{{ label }}</span>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import type { BaseButtonProps } from '@/types/buttonTypes'
import {
  getBaseButtonClasses,
  getBorderButtonTypeClasses,
  getButtonSizeClasses,
  getButtonTypeClasses
} from '@/types/buttonTypes'
import { cn } from '@/utils/tailwindUtil'

interface TextButtonProps extends BaseButtonProps {
  label: string
  onClick: () => void
}

defineOptions({
  inheritAttrs: false
})

const {
  size = 'md',
  type = 'primary',
  border = false,
  disabled = false,
  class: className,
  label,
  onClick
} = defineProps<TextButtonProps>()

const buttonStyle = computed(() => {
  const baseClasses = getBaseButtonClasses()
  const sizeClasses = getButtonSizeClasses(size)
  const typeClasses = border
    ? getBorderButtonTypeClasses(type)
    : getButtonTypeClasses(type)

  return cn(baseClasses, sizeClasses, typeClasses, className)
})
</script>
