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
    <circle cx="12" cy="8" r="3.75" stroke="currentColor" stroke-width="1.8" />
    <path
      d="M4.75 20c0-3.73 3.25-6 7.25-6s7.25 2.27 7.25 6"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
  </svg>
</template>
