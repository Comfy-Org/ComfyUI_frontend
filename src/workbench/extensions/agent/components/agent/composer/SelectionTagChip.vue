<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { title } = defineProps<{
  title: string
}>()
const emit = defineEmits<{ remove: [] }>()

const { t } = useI18n()
</script>

<template>
  <span
    class="rounded-agent bg-agent-pill text-agent-fg inline-flex items-center gap-1.5 py-1 pr-2 pl-1.5 text-xs"
  >
    <span class="text-agent-fg-subtle icon-[lucide--at-sign] size-3.5" />
    <span class="max-w-40 truncate">{{ title }}</span>
    <button
      type="button"
      :aria-label="t('agent.remove')"
      class="text-agent-fg-subtle hover:bg-agent-surface-hover hover:text-agent-fg flex size-4 items-center justify-center rounded-full transition-colors"
      @click="emit('remove')"
    >
      <span class="icon-[lucide--x] size-3" />
    </button>
  </span>
</template>
