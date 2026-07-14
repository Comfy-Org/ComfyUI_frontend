<template>
  <p class="m-0 truncate text-sm/tight text-base-foreground" :title="fileName">
    {{ fileName }}
  </p>
</template>

<script setup lang="ts">
defineProps<{
  fileName: string
}>()
</script>
