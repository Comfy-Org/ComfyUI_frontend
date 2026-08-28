<script setup lang="ts">
import type { StyleValue } from 'vue'

defineProps<{
  src: string
  alt?: string
  imageClass?: string | Record<string, boolean> | unknown[]
  imageStyle?: StyleValue
}>()
</script>

<template>
  <img :src :alt :class="imageClass" :style="imageStyle" draggable="false" />
</template>
