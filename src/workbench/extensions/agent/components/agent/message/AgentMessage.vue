<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  ActivityPart,
  AssistantMessage,
  NoticePart,
  RunApprovalPart,
  PaywallPart,
  TabLinkPart,
  TextPart
} from '../../../services/agent/agentMessageParts'
import { htmlReplyAssets } from '../../../utils/replyAssets'
import { cn } from '@comfyorg/tailwind-utils'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import MarkdownStream from './MarkdownStream.vue'
import AgentPaywallCard from './AgentPaywallCard.vue'
import MessageFeedback from './MessageFeedback.vue'
import RunApprovalCard from './RunApprovalCard.vue'
import TabLinkCard from './TabLinkCard.vue'
import ActivityTrace from './ActivityTrace.vue'
import WorkSummary from './WorkSummary.vue'
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
  answerAsk: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [workflowId: string, workflowName?: string]
  paywallAction: [action: AgentPaywallAction]
}>()

type Group =
  | { kind: 'text'; part: TextPart }
  | { kind: 'notice'; part: NoticePart }
  | { kind: 'paywall'; part: PaywallPart }
  | { kind: 'trace' }
  | { kind: 'tabLinks'; parts: TabLinkPart[] }
  | { kind: 'runApproval'; part: RunApprovalPart }

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
      if (tracePlaced) continue
      tracePlaced = true
      out.push({ kind: 'trace' })
    } else if (part.type === 'text') {
      out.push({ kind: 'text', part })
    } else if (part.type === 'tabLink') {
      const prev = out.at(-1)
      if (prev?.kind === 'tabLinks') prev.parts.push(part)
      else out.push({ kind: 'tabLinks', parts: [part] })
    } else if (part.type === 'runApproval') {
      out.push({ kind: 'runApproval', part })
    } else if (part.type === 'paywall') {
      out.push({ kind: 'paywall', part })
    } else {
      out.push({ kind: 'notice', part })
    }
  }
  return out
})

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
        part.type !== 'runApproval' &&
        (!('state' in part) || part.state === 'done')
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
      icon: 'text-agent-fg-subtle icon-[lucide--loader-circle] animate-spin',
      text: t('agent.working')
    }
  return null
})
</script>

<template>
  <div class="space-y-2 pb-4">
    <template v-for="(group, index) in groups" :key="index">
      <MarkdownStream v-if="group.kind === 'text'" :text="group.part.text" />
      <template v-else-if="group.kind === 'trace'">
        <ActivityTrace v-if="message.streaming" :parts="activityParts" />
        <WorkSummary v-else :parts="activityParts" />
      </template>
      <div
        v-else-if="group.kind === 'tabLinks'"
        role="group"
        class="flex flex-col gap-1"
      >
        <TabLinkCard
          v-for="(link, linkIndex) in group.parts"
          :key="linkIndex"
          :workflow-id="link.workflowId"
          :locator-id="link.locatorId"
          :name="link.name"
        />
      </div>
      <RunApprovalCard
        v-else-if="group.kind === 'runApproval'"
        :part="group.part"
        :answering="answeringAskIds.has(group.part.askId)"
        @answer="(askId, selection) => emit('answerAsk', askId, selection)"
        @open-workflow="
          (workflowId, workflowName) =>
            emit('openWorkflow', workflowId, workflowName)
        "
      />
      <AgentPaywallCard
        v-else-if="group.kind === 'paywall'"
        :presentation="paywallPresentation"
        @paywall-action="emit('paywallAction', $event)"
      />
      <div
        v-else
        :role="group.part.level === 'error' ? 'alert' : 'status'"
        :class="
          cn(
            'rounded-agent flex items-start gap-2 border px-3 py-2 text-sm',
            group.part.level === 'error'
              ? 'border-agent-danger/40 text-agent-danger'
              : 'border-agent-border text-agent-fg-muted'
          )
        "
      >
        <span class="mt-0.5 icon-[lucide--triangle-alert] size-4 shrink-0" />
        <span>{{ group.part.text }}</span>
      </div>
    </template>

    <div
      v-if="status"
      class="text-agent-fg-muted flex h-8 items-center gap-2 rounded-lg px-2 text-sm/5 font-normal"
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
