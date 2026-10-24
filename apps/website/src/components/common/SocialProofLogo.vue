<script setup lang="ts">
import type { CSSProperties } from 'vue'

defineProps<{
  name: string
  src: string
  masked: boolean
  maskStyle?: CSSProperties
}>()
</script>

<template>
  <span
    v-if="masked"
    role="img"
    :aria-label="name"
    class="block h-10 w-40 shrink-0 bg-secondary-mauve mask-contain mask-center mask-no-repeat"
    :style="{ maskImage: `url('${src}')`, ...maskStyle }"
  />
  <img v-else :src="src" :alt="name" />
</template>
