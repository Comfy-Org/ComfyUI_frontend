<script setup lang="ts">
import type {
  ActivityPart,
  AgentAskSelection
} from '../../../services/agent/agentMessageParts'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '../../../services/agent/agentPaywallPresentation'
import ActivityTrace from './ActivityTrace.vue'
import AgentAskCard from './AgentAskCard.vue'
import AgentNoticeCard from './AgentNoticeCard.vue'
import AgentPaywallCard from './AgentPaywallCard.vue'
import MarkdownStream from './MarkdownStream.vue'
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
  answer: [askId: string, selection: AgentAskSelection]
  openWorkflow: [workflowId: string, workflowName?: string]
  paywallAction: [action: AgentPaywallAction]
}>()
</script>

<template>
  <MarkdownStream v-if="group.kind === 'text'" :text="group.part.text" />
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
  <AgentAskCard
    v-else-if="group.kind === 'ask'"
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
  <AgentNoticeCard v-else :part="group.part" />
</template>
