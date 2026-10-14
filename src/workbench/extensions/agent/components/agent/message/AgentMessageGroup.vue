<script setup lang="ts">
import Message from '@/components/ui/message/Message.vue'

import type { ActivityPart } from '../../../services/agent/agentMessageParts'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '../../../services/agent/agentPaywallPresentation'
import ActivityTrace from './ActivityTrace.vue'
import AgentPaywallCard from './AgentPaywallCard.vue'
import MarkdownStream from './MarkdownStream.vue'
import RunApprovalCard from './RunApprovalCard.vue'
import TabLinkCard from './TabLinkCard.vue'
import type { AgentMessageGroup } from './agentMessageGroup'
import WorkSummary from './WorkSummary.vue'

const { group } = defineProps<{
  group: AgentMessageGroup
  streaming: boolean
  activityParts: readonly ActivityPart[]
  answeringAskIds: ReadonlySet<string>
  paywallPresentation: AgentPaywallPresentation
}>()

const emit = defineEmits<{
  answer: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [askId: string, workflowId: string, workflowName?: string]
  approvalShown: [askId: string, workflowId: string | null]
  paywallAction: [action: AgentPaywallAction]
}>()
</script>

<template>
  <MarkdownStream
    v-if="group.kind === 'text'"
    :text="group.parts.map((part) => part.text).join('\n\n')"
  />
  <template v-else-if="group.kind === 'trace'">
    <ActivityTrace v-if="streaming" :parts="activityParts" live />
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
    @answer="(askId, selection) => emit('answer', askId, selection)"
    @shown="(askId, workflowId) => emit('approvalShown', askId, workflowId)"
    @open-workflow="
      (askId, workflowId, workflowName) =>
        emit('openWorkflow', askId, workflowId, workflowName)
    "
  />
  <AgentPaywallCard
    v-else-if="group.kind === 'paywall'"
    :presentation="paywallPresentation"
    :message="group.part.message"
    @paywall-action="emit('paywallAction', $event)"
  />
  <Message
    v-else
    :severity="group.part.level"
    :role="group.part.level === 'error' ? 'alert' : 'status'"
    :aria-live="group.part.level === 'error' ? 'assertive' : 'polite'"
  >
    <template #icon>
      <span class="mt-0.5 icon-[lucide--triangle-alert] block size-4" />
    </template>
    <span class="flex flex-col gap-0.5">
      <span>{{ group.part.text }}</span>
      <span
        v-if="group.part.retryAfterSeconds !== undefined"
        class="text-xs text-muted-foreground"
      >
        {{
          $t('agent.retryAfterSeconds', {
            seconds: group.part.retryAfterSeconds
          })
        }}
      </span>
    </span>
  </Message>
</template>
