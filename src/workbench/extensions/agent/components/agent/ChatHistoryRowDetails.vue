<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ChatHistoryHighlight from './ChatHistoryHighlight.vue'

import type { ChatRowPlan } from '@/workbench/extensions/agent/utils/chatHistoryRowText'

const { plan, date, workflowName, current, working } = defineProps<{
  id: string
  plan: ChatRowPlan
  date: string
  workflowName?: string
  current: boolean
  working: boolean
}>()
const { t } = useI18n()

const matchLabel = computed(() => {
  const field = plan.matchLine?.field
  if (field === 'title') return t('agent.historyMatchTitle')
  if (field === 'workflowName') return t('agent.historyMatchWorkflow')
  return t('agent.historyMatchMessage')
})
</script>

<template>
  <span :id class="flex min-w-0 flex-col gap-0.5">
    <span v-if="plan.matchLine" class="truncate text-xs text-muted-foreground">
      <span class="mr-1">{{ matchLabel }}</span
      ><ChatHistoryHighlight :parts="plan.matchLine.parts" />
    </span>
    <span
      v-else-if="plan.previewParts"
      class="truncate text-xs text-muted-foreground"
      ><ChatHistoryHighlight :parts="plan.previewParts"
    /></span>
    <span class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span class="shrink-0">{{ date }}</span>
      <span v-if="current" class="shrink-0 rounded-sm bg-muted px-1">{{
        t('agent.historyCurrentChat')
      }}</span>
      <span v-if="working" class="shrink-0 text-primary">{{
        t('agent.historyWorking')
      }}</span>
      <span
        v-if="plan.workflowParts"
        :title="workflowName"
        aria-hidden="true"
        class="ml-auto min-w-0 truncate"
        ><ChatHistoryHighlight :parts="plan.workflowParts"
      /></span>
      <span v-if="workflowName" class="sr-only">{{ workflowName }}</span>
    </span>
  </span>
</template>
