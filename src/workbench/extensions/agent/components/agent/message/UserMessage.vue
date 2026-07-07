<script setup lang="ts">
// User message per the design reference: a right-aligned pill, no avatar. text-xs on the
// secondary surface, rounded-lg, px-4 py-3, sized to content.
const { text } = defineProps<{
  text: string
}>()
</script>

<template>
  <div class="flex justify-end">
    <div
      class="bg-agent-surface-raised text-agent-fg w-fit max-w-full rounded-lg px-4 py-3 text-xs whitespace-pre-wrap"
    >
      {{ text }}
    </div>
  </div>
</template>
