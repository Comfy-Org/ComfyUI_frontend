<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import type { AgentSyncStatus } from './useAgentCrdtFollower'

defineProps<{ status: AgentSyncStatus }>()

const { t } = useI18n()
</script>

<template>
  <div
    role="status"
    :aria-label="t('agent.syncStatus')"
    aria-live="polite"
    aria-atomic="true"
    class="shrink-0"
  >
    <p
      v-if="status !== null"
      :class="
        cn(
          'm-0 px-4 py-2 text-sm',
          status === 'failed'
            ? 'text-warning-foreground'
            : 'text-muted-foreground'
        )
      "
    >
      <template v-if="status === 'checking'">
        {{ t('agent.syncChecking') }}
      </template>
      <template v-else-if="status === 'recovering'">
        {{ t('agent.syncRecovering') }}
      </template>
      <template v-else>
        {{ t('agent.syncFailed') }}
      </template>
    </p>
  </div>
</template>
