<template>
  <p
    class="m-0 line-clamp-2 text-sm/tight text-base-foreground break-all"
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
