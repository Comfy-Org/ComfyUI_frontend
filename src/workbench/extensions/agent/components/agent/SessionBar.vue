<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Session / title bar (Figma B4): the row under the header showing the current chat title
// (or "Untitled" for a fresh session). The compact pill is a button that opens Chat
// History; its tooltip reads "Show chat history" to name the action.
const { title } = defineProps<{ title?: string }>()
const emit = defineEmits<{ openHistory: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex shrink-0 items-center px-2 py-1.5">
    <button
      v-tooltip.bottom="{ value: t('agent.showChatHistory'), showDelay: 500 }"
      type="button"
      class="text-agent-fg-muted hover:bg-agent-surface-hover flex h-6 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs transition-colors"
      @click="emit('openHistory')"
    >
      <span class="icon-[lucide--align-justify] size-3.5 shrink-0" />
      <span class="max-w-56 truncate">{{
        title || t('agent.newChatTitle')
      }}</span>
    </button>
  </div>
</template>
