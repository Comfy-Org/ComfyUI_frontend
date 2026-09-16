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
    <line x1="23" y1="9" x2="17" y2="15" stroke-width="2.5" />
    <line x1="17" y1="9" x2="23" y2="15" stroke-width="2.5" />
  </svg>
</template>
