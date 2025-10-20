<template>
  <Button
    v-bind="$attrs"
    unstyled
    :class="buttonStyle"
    :disabled="disabled"
    @click="onClick"
  >
    <slot v-if="iconPosition !== 'right'" name="icon"></slot>
    <span>{{ label }}</span>
    <slot v-if="iconPosition === 'right'" name="icon"></slot>
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

defineOptions({
  inheritAttrs: false
})

interface IconTextButtonProps extends BaseButtonProps {
  iconPosition?: 'left' | 'right'
  label: string
  onClick: () => void
}

const {
  size = 'md',
  type = 'primary',
  border = false,
  disabled = false,
  class: className,
  iconPosition = 'left',
  label,
  onClick
} = defineProps<IconTextButtonProps>()

const buttonStyle = computed(() => {
  const baseClasses = `${getBaseButtonClasses()} justify-start! gap-2`
  const sizeClasses = getButtonSizeClasses(size)
  const typeClasses = border
    ? getBorderButtonTypeClasses(type)
    : getButtonTypeClasses(type)

  return cn(baseClasses, sizeClasses, typeClasses, className)
})
</script>
