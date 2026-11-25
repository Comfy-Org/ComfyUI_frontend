<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import ChatHistoryHighlight from './ChatHistoryHighlight.vue'
import ChatHistoryRowDetails from './ChatHistoryRowDetails.vue'

import type {
  ChatSearchField,
  ChatSearchRange
} from '@/workbench/extensions/agent/utils/chatHistorySearch'
import { planChatRow } from '@/workbench/extensions/agent/utils/chatHistoryRowText'

const {
  title,
  preview,
  date,
  workflowName,
  ranges = {},
  current = false,
  loading = false,
  failed = false,
  working = false
} = defineProps<{
  title: string
  preview?: string
  date?: string
  workflowName?: string
  ranges?: Partial<Record<ChatSearchField, ChatSearchRange[]>>
  current?: boolean
  loading?: boolean
  failed?: boolean
  /** The agent has a turn running in this chat. */
  working?: boolean
}>()
const emit = defineEmits<{ select: [] }>()
const { t } = useI18n()
const displayTitle = computed(() => title.trim() || t('agent.untitledChat'))
const errorId = useId()
const detailsId = useId()
const workingId = useId()
const describedBy = computed(
  () =>
    [
      // The working label sits inside the details line on result rows and
      // stands alone on plain rows, so exactly one of them describes it.
      date === undefined ? (working ? workingId : undefined) : detailsId,
      failed ? errorId : undefined
    ]
      .filter(Boolean)
      .join(' ') || undefined
)

const plan = computed(() =>
  planChatRow({ title, preview, workflowName, ranges, current })
)
const titleParts = computed(() =>
  plan.value.titleParts.length
    ? plan.value.titleParts
    : [{ text: displayTitle.value, highlighted: false }]
)
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <Button
      type="button"
      variant="muted-textonly"
      size="unset"
      :aria-busy="loading"
      :aria-label="displayTitle"
      :aria-describedby="describedBy"
      :disabled="loading"
      data-history-result
      class="min-w-0 items-start justify-start text-left text-xs font-normal"
      @click="emit('select')"
    >
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          :class="
            cn(
              'truncate',
              date !== undefined && 'font-medium text-foreground',
              working && 'agent-shimmer-text'
            )
          "
          ><ChatHistoryHighlight :parts="titleParts"
        /></span>
        <ChatHistoryRowDetails
          v-if="date !== undefined"
          :id="detailsId"
          :plan
          :date
          :workflow-name
          :current
          :working
        />
        <span
          v-else-if="working"
          :id="workingId"
          class="text-xs text-primary"
          >{{ t('agent.historyWorking') }}</span
        >
      </span>
      <i
        v-if="loading"
        aria-hidden="true"
        class="icon-[lucide--loader-circle] animate-spin"
      />
    </Button>
    <span v-if="loading" role="status" class="sr-only">{{
      t('g.loading')
    }}</span>
    <span
      v-if="failed"
      :id="errorId"
      role="alert"
      class="text-xs whitespace-normal text-destructive"
      >{{ t('agent.historyOpenFailed') }}</span
    >
  </div>
</template>
