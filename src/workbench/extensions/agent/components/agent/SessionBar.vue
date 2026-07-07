<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Session / title bar (Figma B4): the row under the header showing the current chat title
// (or "New Chat" for a fresh session). The whole row is a button that opens Chat History.
const { title } = defineProps<{ title?: string }>()
const emit = defineEmits<{ openHistory: [] }>()

const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="border-agent-border text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm transition-colors"
    @click="emit('openHistory')"
  >
    <span class="text-agent-fg-subtle icon-[lucide--menu] size-4 shrink-0" />
    <span class="min-w-0 flex-1 truncate">{{
      title || t('agent.newChatTitle')
    }}</span>
    <span
      class="text-agent-fg-subtle icon-[lucide--chevron-down] size-4 shrink-0"
    />
  </button>
</template>
