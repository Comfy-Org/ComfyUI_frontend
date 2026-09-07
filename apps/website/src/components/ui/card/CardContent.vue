<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div data-slot="card-content" :class="cn('px-6', className)">
    <slot />
  </div>
</template>
