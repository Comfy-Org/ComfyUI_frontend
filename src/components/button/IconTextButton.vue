<template>
  <Button unstyled :class="buttonStyle" @click="onClick">
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
  getButtonSizeClasses,
  getButtonTypeClasses
} from '@/types/buttonTypes'

interface IconTextButtonProps extends BaseButtonProps {
  iconPosition?: 'left' | 'right'
  label: string
  onClick: () => void
}

const {
  size = 'md',
  type = 'primary',
  class: className,
  iconPosition = 'left',
  label,
  onClick
} = defineProps<IconTextButtonProps>()

const buttonStyle = computed(() => {
  const baseClasses = `${getBaseButtonClasses()} !justify-start gap-2`
  const sizeClasses = getButtonSizeClasses(size)
  const typeClasses = getButtonTypeClasses(type)

  return [baseClasses, sizeClasses, typeClasses, className]
    .filter(Boolean)
    .join(' ')
})
</script>
