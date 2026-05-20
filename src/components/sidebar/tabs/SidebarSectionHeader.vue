<template>
  <h3
    class="mb-0 px-4 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
  >
    {{ text }}
  </h3>
</template>

<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>
