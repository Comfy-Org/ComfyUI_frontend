<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: customClass = '' } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <svg
    role="status"
    :class="cn('size-6 animate-spin text-muted-foreground', customClass)"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      class="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="4"
    />
    <path
      class="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
    />
  </svg>
</template>
