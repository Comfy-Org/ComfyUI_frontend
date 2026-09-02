<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('bg-transparency-white-t4 rounded-5xl p-2', className)">
    <slot />
  </div>
</template>
