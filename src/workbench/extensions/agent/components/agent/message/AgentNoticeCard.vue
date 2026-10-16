<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Message from '@/components/ui/message/Message.vue'

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
  <Message
    :severity="notice.level"
    :role="notice.level === 'error' ? 'alert' : 'status'"
    :aria-live="notice.level === 'error' ? 'assertive' : 'polite'"
  >
    <template #icon>
      <span class="mt-0.5 icon-[lucide--triangle-alert] block size-4" />
    </template>
    <span class="flex flex-col gap-0.5">
      <span>{{ notice.text }}</span>
      <span
        v-if="notice.retryAfterSeconds !== undefined"
        class="text-xs text-muted-foreground"
      >
        {{
          t('agent.retryAfterSeconds', {
            seconds: notice.retryAfterSeconds
          })
        }}
      </span>
    </span>
  </Message>
</template>
