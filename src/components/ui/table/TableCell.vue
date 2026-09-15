<template>
  <td :class="cn('px-2 py-2.5 align-middle whitespace-nowrap', className)">
    <slot />
  </td>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>
