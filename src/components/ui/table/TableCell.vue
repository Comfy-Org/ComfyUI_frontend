<template>
  <td :class="cn('px-2 py-2.5 align-middle whitespace-nowrap', className)">
    <slot />
  </td>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>
