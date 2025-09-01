<template>
  <Button unstyled :class="buttonStyle" role="button" @click="onClick">
    <span>{{ label }}</span>
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

interface TextButtonProps extends BaseButtonProps {
  label: string
  onClick: () => void
}

const {
  size = 'md',
  type = 'primary',
  class: className,
  label,
  onClick
} = defineProps<TextButtonProps>()

const buttonStyle = computed(() => {
  const baseClasses = getBaseButtonClasses()
  const sizeClasses = getButtonSizeClasses(size)
  const typeClasses = getButtonTypeClasses(type)

  return [baseClasses, sizeClasses, typeClasses, className]
    .filter(Boolean)
    .join(' ')
})
</script>
