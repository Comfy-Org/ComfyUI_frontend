<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  ActivityPart,
  AgentAskAnswer,
  AssistantMessage,
  TextPart
} from '../../../services/agent/agentMessageParts'
import { isAskPart } from '../../../services/agent/agentMessageParts'
import { htmlReplyAssets } from '../../../utils/replyAssets'
import { cn } from '@comfyorg/tailwind-utils'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import AgentMessageGroup from './AgentMessageGroup.vue'
import MessageFeedback from './MessageFeedback.vue'
import type { AgentMessageGroup as Group } from './agentMessageGroup'
import { toPartGroup } from './agentMessageGroup'
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
const { t } = useI18n()

const emit = defineEmits<{
  feedback: [vote: 'up' | 'down' | null]
  answerAsk: [askId: string, answer: AgentAskAnswer]
  openWorkflow: [workflowId: string, workflowName?: string]
  paywallAction: [action: AgentPaywallAction]
}>()

// Every thinking and tool part of the turn reads as one trace, wherever they fall
// between the reply's text parts, so the completed turn folds into a single summary.
const activityParts = computed<readonly ActivityPart[]>(() =>
  message.parts.filter(
    (part): part is ActivityPart =>
      part.type === 'tool' || part.type === 'thinking'
  )
)

const groups = computed<Group[]>(() => {
  const out: Group[] = []
  let tracePlaced = activityParts.value.length === 0
  for (const part of message.parts) {
    if (part.type === 'tool' || part.type === 'thinking') {
      if (!tracePlaced) out.push({ kind: 'trace' })
      tracePlaced = true
    } else if (part.type === 'tabLink') {
      const prev = out.at(-1)
      if (prev?.kind === 'tabLinks') prev.parts.push(part)
      else out.push({ kind: 'tabLinks', parts: [part] })
    } else {
      out.push(toPartGroup(part))
    }
  }
  return out
})

// An ask card holds the user's in-progress answer, so it keeps its identity
// when an earlier group in the message goes away.
function groupKey(group: Group, index: number): string {
  return group.kind === 'ask' ? `ask:${group.part.askId}` : `group:${index}`
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

const replyAssets = computed(() =>
  showActions.value ? htmlReplyAssets(renderMarkdownToHtml(markdown.value)) : []
)

// The stretch after the last tool settles and before the first reply token, with
// no approval pending: the turn is still running but nothing on screen moves.
const composing = computed(
  () =>
    message.streaming &&
    message.parts.length > 0 &&
    message.parts.every(
      (part) =>
        !isAskPart(part) && (!('state' in part) || part.state === 'done')
    )
)

// The one live row this message may show, when the trace itself is not carrying
// the signal. Narrating and composing never overlap: narrating needs a streaming
// thinking part, composing needs every part settled.
const status = computed(() => {
  const narrating =
    activityParts.value.length === 0 &&
    (message.thinking || (message.streaming && !message.parts.length))
  if (narrating)
    return {
      icon: 'icon-[lucide--brain]',
      text: message.thinkingText || t('agent.thinking')
    }
  if (composing.value)
    return {
      icon: 'text-muted-foreground icon-[lucide--loader-circle] animate-spin',
      text: t('agent.working')
    }
  return null
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
        @open-workflow="
          (workflowId, workflowName) =>
            emit('openWorkflow', workflowId, workflowName)
        "
        @paywall-action="emit('paywallAction', $event)"
      />
    </template>

    <div
      v-if="status"
      class="flex h-8 items-center gap-2 rounded-lg px-2 text-sm/5 font-normal text-muted-foreground"
    >
      <span :class="cn('size-4 shrink-0', status.icon)" />
      <span class="agent-shimmer-text min-w-0 truncate">{{ status.text }}</span>
    </div>

    <MessageFeedback
      v-if="showActions"
      :markdown
      :assets="replyAssets"
      @feedback="emit('feedback', $event)"
    />
  </div>
</template>
