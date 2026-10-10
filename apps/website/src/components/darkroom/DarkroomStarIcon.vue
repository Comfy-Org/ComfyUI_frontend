<script setup lang="ts">
const { filled = false } = defineProps<{ filled?: boolean }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linejoin="round"
  >
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
    />
  </svg>
</template>
