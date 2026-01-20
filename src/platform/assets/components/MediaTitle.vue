<template>
  <p
    class="m-0 line-clamp-2 text-sm leading-tight break-all text-base-foreground"
    :title="fileName"
  >
    {{ fileName }}
  </p>
</template>

<script setup lang="ts">
defineProps<{
  fileName: string
}>()
</script>
