<template>
  <div :class="topStyle">
    <slot class="absolute top-0 left-0 h-full w-full"></slot>

    <div
      v-if="slots['top-left']"
      :class="getSlotClasses('top-left', topLeftClass)"
    >
      <slot name="top-left"></slot>
    </div>

    <div
      v-if="slots['top-right']"
      :class="getSlotClasses('top-right', topRightClass)"
    >
      <slot name="top-right"></slot>
    </div>

    <div
      v-if="slots['center-left']"
      :class="getSlotClasses('center-left', centerLeftClass)"
    >
      <slot name="center-left"></slot>
    </div>

    <div
      v-if="slots['center-right']"
      :class="getSlotClasses('center-right', centerRightClass)"
    >
      <slot name="center-right"></slot>
    </div>

    <div
      v-if="slots['bottom-left']"
      :class="getSlotClasses('bottom-left', bottomLeftClass)"
    >
      <slot name="bottom-left"></slot>
    </div>

    <div
      v-if="slots['bottom-right']"
      :class="getSlotClasses('bottom-right', bottomRightClass)"
    >
      <slot name="bottom-right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const slots = useSlots()

const {
  ratio = 'square',
  topLeftClass,
  topRightClass,
  centerLeftClass,
  centerRightClass,
  bottomLeftClass,
  bottomRightClass
} = defineProps<{
  ratio?: 'square' | 'landscape'
  topLeftClass?: string
  topRightClass?: string
  centerLeftClass?: string
  centerRightClass?: string
  bottomLeftClass?: string
  bottomRightClass?: string
}>()

const topStyle = computed(() => {
  const baseClasses = 'relative p-0'

  const ratioClasses = {
    square: 'aspect-square',
    landscape: 'aspect-48/27'
  }

  return `${baseClasses} ${ratioClasses[ratio]}`
})

// Get default classes for each slot position
const defaultSlotClasses = {
  'top-left': 'absolute top-2 left-2 flex flex-wrap justify-start gap-2',
  'top-right': 'absolute top-2 right-2 flex flex-wrap justify-end gap-2',
  'center-left':
    'absolute top-1/2 left-2 flex -translate-y-1/2 flex-wrap justify-start gap-2',
  'center-right':
    'absolute top-1/2 right-2 flex -translate-y-1/2 flex-wrap justify-end gap-2',
  'bottom-left': 'absolute bottom-2 left-2 flex flex-wrap justify-start gap-2',
  'bottom-right': 'absolute right-2 bottom-2 flex flex-wrap justify-end gap-2'
}

// Function to merge default and custom classes
function getSlotClasses(
  position: keyof typeof defaultSlotClasses,
  customClass?: string
) {
  return cn(defaultSlotClasses[position], customClass)
}
</script>
