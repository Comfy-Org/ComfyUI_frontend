<template>
  <img
    :src="isImageError ? DEFAULT_ICON : imgSrc"
    :alt="nodePack.name + ' icon'"
    class="object-contain rounded-lg max-h-72 max-w-72"
    :style="{ width: cssWidth, height: cssHeight }"
    @error="isImageError = true"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { components } from '@/types/comfyRegistryTypes'

const DEFAULT_ICON = '/assets/images/fallback-gradient-avatar.svg'

const {
  nodePack,
  width = '4.5rem',
  height = '4.5rem'
} = defineProps<{
  nodePack: components['schemas']['Node']
  width?: string
  height?: string
}>()

const isImageError = ref(false)
const shouldShowFallback = computed(
  () => !nodePack.icon || nodePack.icon.trim() === '' || isImageError.value
)
const imgSrc = computed(() =>
  shouldShowFallback.value ? DEFAULT_ICON : nodePack.icon
)

const convertToCssValue = (value: string | number) =>
  typeof value === 'number' ? `${value}rem` : value

const cssWidth = computed(() => convertToCssValue(width))
const cssHeight = computed(() => convertToCssValue(height))
</script>
