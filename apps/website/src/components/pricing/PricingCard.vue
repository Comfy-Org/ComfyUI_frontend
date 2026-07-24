<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn('rounded-4.5xl bg-primary-comfy-ink p-8', className)">
    <slot />
  </div>
</template>
