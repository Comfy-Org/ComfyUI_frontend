<template>
  <img
    :src="isImageError ? DEFAULT_BANNER : imgSrc"
    :alt="nodePack.name + ' banner'"
    class="object-cover"
    :style="{ width: cssWidth, height: cssHeight }"
    @error="isImageError = true"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { components } from '@/types/comfyRegistryTypes'

const DEFAULT_BANNER = '/assets/images/fallback-gradient-avatar.svg'

const {
  nodePack,
  width = '100%',
  height = '12rem'
} = defineProps<{
  nodePack: components['schemas']['Node'] & { banner?: string } // Temporary measure until banner is in backend
  width?: string
  height?: string
}>()

const isImageError = ref(false)
const shouldShowFallback = computed(
  () => !nodePack.banner || nodePack.banner.trim() === '' || isImageError.value
)
const imgSrc = computed(() =>
  shouldShowFallback.value ? DEFAULT_BANNER : nodePack.banner
)

const convertToCssValue = (value: string | number) =>
  typeof value === 'number' ? `${value}rem` : value

const cssWidth = computed(() => convertToCssValue(width))
const cssHeight = computed(() => convertToCssValue(height))
</script>
