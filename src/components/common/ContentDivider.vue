<template>
  <hr
    :class="{
      'm-0': true,
      'border-t': orientation === 'horizontal',
      'border-l': orientation === 'vertical',
      'h-full': orientation === 'vertical',
      'w-full': orientation === 'horizontal'
    }"
    :style="{
      borderColor: isLightTheme ? '#DCDAE1' : '#2C2C2C',
      borderWidth: `${width}px !important`
    }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const colorPaletteStore = useColorPaletteStore()
const { orientation = 'horizontal', width = 0.3 } = defineProps<{
  orientation?: 'horizontal' | 'vertical'
  width?: number
}>()

const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)
</script>
