<script setup lang="ts">
import { computed } from 'vue'

import type {
  ActivityPart,
  AssistantMessage,
  NoticePart,
  PaywallPart,
  RunApprovalPart,
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
import ToolCallGroup from './ToolCallGroup.vue'

const {
  message,
  answeringAskIds = new Set<string>(),
  showAddCredits = true,
  showUpgrade = true
} = defineProps<{
  message: AssistantMessage
  answeringAskIds?: ReadonlySet<string>
  showAddCredits?: boolean
  showUpgrade?: boolean
}>()
const emit = defineEmits<{
  feedback: [vote: 'up' | 'down' | null]
  answerAsk: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [workflowId: string, workflowName?: string]
  addCredits: []
  upgradeSubscription: []
}>()

type Group =
  | { kind: 'text'; part: TextPart }
  | { kind: 'notice'; part: NoticePart }
  | { kind: 'paywall'; part: PaywallPart }
  | { kind: 'activity'; parts: ActivityPart[] }
  | { kind: 'tabLinks'; parts: TabLinkPart[] }
  | { kind: 'runApproval'; part: RunApprovalPart }

const groups = computed<Group[]>(() => {
  const out: Group[] = []
  const hasTools = message.parts.some((part) => part.type === 'tool')
  for (const part of message.parts) {
    const prev = out.at(-1)
    if (part.type === 'tool' || part.type === 'thinking') {
      if (!hasTools) continue
      if (prev?.kind === 'activity' && prev.parts[0]?.type === part.type)
        prev.parts.push(part)
      else out.push({ kind: 'activity', parts: [part] })
    } else if (part.type === 'text') {
      out.push({ kind: 'text', part })
    } else if (part.type === 'tabLink') {
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

const hasTools = computed(() =>
  message.parts.some((part) => part.type === 'tool')
)
</script>

<template>
  <div class="space-y-2 pb-4">
    <template v-for="(group, index) in groups" :key="index">
      <MarkdownStream v-if="group.kind === 'text'" :text="group.part.text" />
      <ToolCallGroup
        v-else-if="group.kind === 'activity'"
        :parts="group.parts"
        :active="message.streaming && index === groups.length - 1"
      />
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
        :show-add-credits="showAddCredits"
        :show-upgrade="showUpgrade"
        @add-credits="emit('addCredits')"
        @upgrade-subscription="emit('upgradeSubscription')"
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
      v-if="
        !hasTools &&
        (message.thinking || (message.streaming && !message.parts.length))
      "
      class="text-agent-fg-muted flex h-8 items-center gap-2 rounded-lg px-2 text-sm leading-none font-normal"
    >
      <span class="icon-[lucide--brain] size-4 shrink-0" />
      <span class="agent-shimmer-text min-w-0 truncate">{{
        message.thinkingText || $t('agent.thinking')
      }}</span>
    </div>

    <MessageFeedback
      v-if="showActions"
      :markdown
      :assets="replyAssets"
      @feedback="emit('feedback', $event)"
    />
  </div>
</template>
