<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

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
  openWorkflow: [workflowId: string, workflowName?: string]
  paywallAction: [action: AgentPaywallAction]
}>()
</script>

<template>
  <MarkdownStream v-if="group.kind === 'text'" :text="group.part.text" />
  <template v-else-if="group.kind === 'trace'">
    <ActivityTrace v-if="streaming" :parts="activityParts" />
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
    @open-workflow="
      (workflowId, workflowName) =>
        emit('openWorkflow', workflowId, workflowName)
    "
  />
  <AgentPaywallCard
    v-else-if="group.kind === 'paywall'"
    :presentation="paywallPresentation"
    :message="group.part.message"
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
