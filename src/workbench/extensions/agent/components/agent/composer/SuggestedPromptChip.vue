<script setup lang="ts">
// Click INSERTS the prompt into the composer (never sends) per the locked Figma decision.
const { text } = defineProps<{ text: string }>()
const emit = defineEmits<{ insert: [text: string] }>()
</script>

<template>
  <button
    type="button"
    class="rounded-agent border-agent-border text-agent-fg-muted hover:border-agent-border-strong hover:text-agent-fg focus-visible:ring-agent-accent border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    @click="emit('insert', text)"
  >
    {{ text }}
  </button>
</template>
