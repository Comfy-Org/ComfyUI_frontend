<template>
  <div
    class="flex flex-col px-4 py-2 text-sm text-muted-foreground border-t border-border-default"
  >
    <p v-if="promptText">
      {{ promptText }}
    </p>
  </div>
</template>
<script setup lang="ts">
import type { MaybeRefOrGetter } from 'vue'

defineProps<{
  promptText?: MaybeRefOrGetter<string>
}>()
</script>
