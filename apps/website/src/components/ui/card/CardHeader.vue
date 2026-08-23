<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div data-slot="card-header" :class="cn('flex flex-col gap-1.5', className)">
    <slot />
  </div>
</template>
