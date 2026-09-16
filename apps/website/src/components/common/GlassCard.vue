<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('rounded-5xl bg-transparency-white-t4 p-2', className)">
    <slot />
  </div>
</template>
