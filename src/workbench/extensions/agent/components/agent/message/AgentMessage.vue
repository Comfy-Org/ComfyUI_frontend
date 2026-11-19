<script setup lang="ts">
import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import type { AgentPaywallSurface } from '@comfyorg/telemetry/types'
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCreditUsageSummary } from '@/workbench/extensions/agent/experiments/creditUsageSummary'
import type {
  ActivityPart,
  AssistantMessage,
  TextPart
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import {
  askIdOf,
  isOpenAskPart
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { htmlReplyAssets } from '@/workbench/extensions/agent/utils/replyAssets'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import AgentMessageGroup from './AgentMessageGroup.vue'
import MessageFeedback from './MessageFeedback.vue'
import type { AgentMessageGroup as Group } from './agentMessageGroup'
import { groupMessageParts } from './agentMessageGroup'
import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'

const {
  message,
  answeringAskIds = new Set<string>(),
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION
} = defineProps<{
  message: AssistantMessage
  answeringAskIds?: ReadonlySet<string>
  paywallPresentation?: AgentPaywallPresentation
}>()
const { locale, t } = useI18n()

const emit = defineEmits<{
  feedback: [vote: 'up' | 'down' | null]
  answerAsk: [askId: string, answer: AgentAnswerRequest]
  openWorkflow: [askId: string, workflowId: string, workflowName?: string]
  approvalShown: [askId: string, turnId: string, workflowId: string | null]
  paywallAction: [action: AgentPaywallAction, surface: AgentPaywallSurface]
}>()

// Every thinking and tool part of the turn reads as one trace, wherever they fall
// between the reply's text parts, so the completed turn folds into a single summary.
const activityParts = computed<readonly ActivityPart[]>(() =>
  message.parts.filter(
    (part): part is ActivityPart =>
      part.type === 'tool' || part.type === 'thinking'
  )
)

const groups = computed<Group[]>(() => groupMessageParts(message.parts))

function groupKey(group: Group, index: number): string {
  const askId = 'part' in group ? askIdOf(group.part) : undefined
  return askId === undefined ? `group:${index}` : `ask:${askId}`
}

const markdown = computed(() =>
  message.parts
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
)

const showActions = computed(
  () => !message.streaming && markdown.value.length > 0
)

const creditUsageSummary = useCreditUsageSummary()
const hasCreditUsage = computed(
  () =>
    !message.streaming &&
    Boolean(message.creditsUsed && message.creditsUsed > 0)
)
watchEffect(() => {
  if (hasCreditUsage.value) creditUsageSummary.expose()
})

const creditUsage = computed(() => {
  const creditsUsed = message.creditsUsed
  if (
    !hasCreditUsage.value ||
    !creditUsageSummary.showSummary.value ||
    creditsUsed === undefined
  )
    return null
  const format = new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 2
  }).format
  const credits = creditsUsed < 0.01 ? `<${format(0.01)}` : format(creditsUsed)
  const plural = creditsUsed < 0.01 ? 0.01 : Number(creditsUsed.toFixed(2))
  return t('agent.creditsUsed', { credits }, { plural, escapeParameter: false })
})

const replyAssets = computed(() =>
  showActions.value ? htmlReplyAssets(renderMarkdownToHtml(markdown.value)) : []
)

const hasOpenAsk = computed(() => message.parts.some(isOpenAskPart))

const narrating = computed(
  () =>
    activityParts.value.length === 0 &&
    (message.thinking || (message.streaming && !message.parts.length))
)

const composing = computed(
  () =>
    message.streaming &&
    message.parts.length > 0 &&
    !hasOpenAsk.value &&
    message.parts.every((part) => !('state' in part) || part.state === 'done')
)

const waiting = computed(
  () => message.streaming && Boolean(message.waitHint) && !hasOpenAsk.value
)

const status = computed(() => {
  if (narrating.value)
    return {
      icon: 'icon-[lucide--brain]',
      text: message.thinkingText || t('agent.thinking')
    }
  if (composing.value || waiting.value)
    return {
      icon: 'text-muted-foreground icon-[lucide--loader-circle] animate-spin',
      text: t('agent.working')
    }
  return null
})

type TurnWaitKind = 'ownChats' | 'queue' | 'busy'

const TURN_WAIT_KEY = {
  ownChats: 'agent.turnWaitUserFull',
  queue: 'agent.turnWaitQueue',
  busy: 'agent.turnWaitBusy'
} as const satisfies Record<TurnWaitKind, string>

function turnWaitKind(reason: string): TurnWaitKind {
  if (reason === 'turn_user_full' || reason === 'user_inflight')
    return 'ownChats'
  if (reason === 'turn_queue_position' || reason === 'queue_position')
    return 'queue'
  return 'busy'
}

const waitHintText = computed(() => {
  if (!message.streaming || !status.value || !message.waitHint) return null
  const { reason, position } = message.waitHint
  const kind = turnWaitKind(reason)
  if (kind === 'queue' && position > 0)
    return t('agent.turnWaitQueuePosition', { position })
  return t(TURN_WAIT_KEY[kind])
})
</script>

<template>
  <div class="space-y-2 pb-4">
    <template v-for="(group, index) in groups" :key="groupKey(group, index)">
      <AgentMessageGroup
        :group
        :streaming="message.streaming"
        :activity-parts="activityParts"
        :answering-ask-ids="answeringAskIds"
        :paywall-presentation="paywallPresentation"
        @answer="(askId, answer) => emit('answerAsk', askId, answer)"
        @approval-shown="
          (askId, workflowId) =>
            emit('approvalShown', askId, message.id, workflowId)
        "
        @open-workflow="
          (askId, workflowId, workflowName) =>
            emit('openWorkflow', askId, workflowId, workflowName)
        "
        @paywall-action="
          (action, surface) => emit('paywallAction', action, surface)
        "
      />
    </template>

    <div
      v-if="status"
      class="flex h-8 items-center gap-2 rounded-lg px-2 text-sm/5 font-normal text-muted-foreground"
    >
      <i aria-hidden="true" :class="status.icon" />
      <span class="agent-shimmer-text min-w-0 truncate">{{ status.text }}</span>
    </div>
    <p
      v-if="waitHintText"
      data-testid="agent-turn-wait-hint"
      class="m-0 pr-2 pl-8 text-xs/4 text-muted-foreground"
    >
      {{ waitHintText }}
    </p>

    <div
      v-if="creditUsage"
      data-testid="agent-credit-usage"
      class="flex items-center gap-1.5 px-2 text-xs/5 text-muted-foreground"
    >
      <i aria-hidden="true" class="icon-[lucide--coins] size-3.5" />
      <span>{{ creditUsage }}</span>
    </div>

    <MessageFeedback
      v-if="showActions"
      :markdown
      :assets="replyAssets"
      @feedback="emit('feedback', $event)"
    />
  </div>
</template>
