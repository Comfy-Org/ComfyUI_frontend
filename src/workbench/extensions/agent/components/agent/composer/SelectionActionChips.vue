<script setup lang="ts">
// Staged for FE-1187 host wiring (canvas selection is a V0 tech-design surface); built and tested, not yet wired into the shipped panel.
// Quick actions for a single selected node (e.g. Explain / Improve). Each inserts its
// prompt into the composer; live-only, so the parent hides these while disconnected.
interface SelectionAction {
  label: string
  prompt: string
}

const { actions } = defineProps<{ actions: SelectionAction[] }>()
const emit = defineEmits<{ action: [prompt: string] }>()
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="action in actions"
      :key="action.label"
      type="button"
      class="rounded-agent border-agent-border text-agent-fg-muted hover:border-agent-border-strong hover:text-agent-fg border px-2 py-1 text-xs transition-colors"
      @click="emit('action', action.prompt)"
    >
      {{ action.label }}
    </button>
  </div>
</template>
