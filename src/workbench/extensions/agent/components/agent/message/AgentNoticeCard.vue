<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  AskUnavailablePart,
  NoticePart
} from '../../../services/agent/agentMessageParts'

const { part } = defineProps<{ part: NoticePart | AskUnavailablePart }>()

const { t } = useI18n()

const notice = computed<NoticePart>(() =>
  part.type === 'askUnavailable'
    ? { type: 'notice', level: 'warning', text: t('agent.askUnavailable') }
    : part
)
</script>

<template>
  <div
    :role="notice.level === 'error' ? 'alert' : 'status'"
    :class="
      cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
        notice.level === 'error'
          ? 'border-destructive-background/40 text-destructive-background'
          : 'border-component-node-border text-muted-foreground'
      )
    "
  >
    <span class="mt-0.5 icon-[lucide--triangle-alert] size-4 shrink-0" />
    <span class="flex flex-col gap-0.5">
      <span>{{ notice.text }}</span>
      <span
        v-if="notice.retryAfterSeconds !== undefined"
        class="text-xs text-muted-foreground"
      >
        {{
          $t('agent.retryAfterSeconds', {
            seconds: notice.retryAfterSeconds
          })
        }}
      </span>
    </span>
  </div>
</template>
