<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// An @-tag for a canvas node staged into the next message. Staged once per selection and
// cleared after submit (lifecycle owned by useCanvasSelection).
const { label } = defineProps<{ label: string }>()
const emit = defineEmits<{ remove: [] }>()

const { t } = useI18n()
</script>

<template>
  <span
    class="rounded-agent bg-agent-accent/15 text-agent-accent inline-flex items-center gap-1 px-2 py-1 text-xs"
  >
    <span class="icon-[lucide--at-sign] size-3" />
    <span class="max-w-32 truncate">{{ label }}</span>
    <button
      type="button"
      :aria-label="t('agent.remove')"
      class="hover:bg-agent-accent/20 flex size-4 items-center justify-center rounded-full transition-colors"
      @click="emit('remove')"
    >
      <span class="icon-[lucide--x] size-3" />
    </button>
  </span>
</template>
