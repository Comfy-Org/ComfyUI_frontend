<template>
  <tbody :class="cn('[&_tr:last-child]:border-0', className)">
    <slot />
  </tbody>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>
