<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import ChatHistoryHighlight from './ChatHistoryHighlight.vue'

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
  narrow = false,
  current = false,
  loading = false,
  failed = false
} = defineProps<{
  title: string
  preview?: string
  date?: string
  workflowName?: string
  ranges?: Partial<Record<ChatSearchField, ChatSearchRange[]>>
  narrow?: boolean
  current?: boolean
  loading?: boolean
  failed?: boolean
}>()
const emit = defineEmits<{ select: [] }>()
const { t } = useI18n()
const displayTitle = computed(() => title.trim() || t('agent.untitledChat'))
const errorId = useId()
const detailsId = useId()
const describedBy = computed(
  () =>
    [date === undefined ? undefined : detailsId, failed ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined
)

const plan = computed(() =>
  planChatRow({ title, preview, workflowName, ranges, narrow, current })
)
const titleParts = computed(() =>
  plan.value.titleParts.length
    ? plan.value.titleParts
    : [{ text: displayTitle.value, highlighted: false }]
)
const matchLabel = computed(() => {
  const field = plan.value.matchLine?.field
  if (field === 'title') return t('agent.historyMatchTitle')
  if (field === 'workflowName') return t('agent.historyMatchWorkflow')
  return t('agent.historyMatchMessage')
})
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
      <i
        v-if="loading"
        aria-hidden="true"
        class="icon-[lucide--loader-circle] animate-spin"
      />
      <i v-else aria-hidden="true" class="icon-[lucide--circle-check]" />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          :class="
            cn('truncate', date !== undefined && 'font-medium text-foreground')
          "
          ><ChatHistoryHighlight :parts="titleParts"
        /></span>
        <template v-if="date !== undefined">
          <span :id="detailsId" class="flex min-w-0 flex-col gap-0.5">
            <span
              v-if="plan.matchLine"
              class="truncate text-xs text-muted-foreground"
            >
              <span class="mr-1">{{ matchLabel }}</span
              ><ChatHistoryHighlight :parts="plan.matchLine.parts" />
            </span>
            <span
              v-else-if="plan.previewParts"
              class="truncate text-xs text-muted-foreground"
              ><ChatHistoryHighlight :parts="plan.previewParts"
            /></span>
            <span
              class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
            >
              <span class="shrink-0">{{ date }}</span>
              <span v-if="current" class="shrink-0 rounded-sm bg-muted px-1">{{
                t('agent.historyCurrentChat')
              }}</span>
              <span
                v-if="plan.workflowParts"
                :title="workflowName"
                aria-hidden="true"
                class="ml-auto min-w-0 truncate"
                ><ChatHistoryHighlight :parts="plan.workflowParts"
              /></span>
              <span v-if="workflowName" class="sr-only">{{
                workflowName
              }}</span>
            </span>
          </span>
        </template>
      </span>
    </Button>
    <span v-if="loading" role="status" class="sr-only">{{
      t('g.loading')
    }}</span>
    <span
      v-if="failed"
      :id="errorId"
      role="alert"
      class="pl-6 text-xs whitespace-normal text-destructive"
      >{{ t('agent.historyOpenFailed') }}</span
    >
  </div>
</template>
