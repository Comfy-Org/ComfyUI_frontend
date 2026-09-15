<template>
  <div :class="cn('relative w-full overflow-auto', className)">
    <table
      class="w-full table-fixed caption-bottom border-separate border-spacing-0 text-sm"
    >
      <slot />
    </table>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>
