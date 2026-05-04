<template>
  <span
    class="rounded-full bg-base-foreground px-1 py-0.5 text-2xs font-bold text-base-background uppercase"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>
