<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    :class="$props.class"
  >
    <path
      d="M5 11.5811L10.2582 18.0581L20 6.05811"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
