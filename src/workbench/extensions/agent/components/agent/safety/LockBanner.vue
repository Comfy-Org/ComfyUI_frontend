<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { LockState } from './safetyTypes'

// Shows while the agent holds (or is claiming) the canvas lock. Take control is always
// offered here — the always-visible reclaim button is one of the five lock failsafes.
const { state } = defineProps<{ state: LockState }>()
const emit = defineEmits<{ takeControl: [] }>()

const { t } = useI18n()
const show = computed(() => state === 'LOCKED' || state === 'LOCK_PENDING')
</script>

<template>
  <div
    v-if="show"
    class="border-agent-border bg-agent-surface-raised flex items-center gap-2 border-b px-4 py-2 text-sm"
  >
    <span class="text-agent-accent icon-[lucide--lock] size-4" />
    <span class="text-agent-fg-muted flex-1">{{
      t('agent.agentEditing')
    }}</span>
    <Button
      size="md"
      variant="textonly"
      class="border-agent-border focus-visible:ring-agent-accent rounded-xl border border-solid px-3 text-sm focus-visible:ring-2"
      @click="emit('takeControl')"
    >
      {{ t('agent.takeControl') }}
    </Button>
  </div>
</template>
