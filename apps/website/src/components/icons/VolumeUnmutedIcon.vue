<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    stroke-width="1.5"
    aria-hidden="true"
    :class="$props.class"
  >
    <path
      d="M11 5L6 9H2v6h4l5 4V5z"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M15.54 8.46a5 5 0 0 1 0 7.07"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M19.07 4.93a10 10 0 0 1 0 14.14"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
</template>
