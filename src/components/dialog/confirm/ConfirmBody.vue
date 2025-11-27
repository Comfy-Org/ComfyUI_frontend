<template>
  <div
    class="flex flex-col px-4 py-2 text-sm text-muted-foreground border-t border-border-default"
  >
    <p v-if="confirmationText">
      {{ confirmationText }}
    </p>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  confirmationText?: string
}>()
</script>
