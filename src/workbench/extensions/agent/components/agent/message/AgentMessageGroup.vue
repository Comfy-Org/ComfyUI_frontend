<script setup lang="ts">
import type { AgentAnswerRequest } from '../../../schemas/agentApiSchema'
import type { ActivityPart } from '../../../services/agent/agentMessageParts'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '../../../services/agent/agentPaywallPresentation'
import ActivityTrace from './ActivityTrace.vue'
import AgentNoticeCard from './AgentNoticeCard.vue'
import AgentPaywallCard from './AgentPaywallCard.vue'
import AskUserCard from './AskUserCard.vue'
import DeleteApprovalCard from './DeleteApprovalCard.vue'
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
  answer: [askId: string, answer: AgentAnswerRequest]
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
    @answer="
      (askId, selection) => emit('answer', askId, { selected: [selection] })
    "
    @shown="(askId, workflowId) => emit('approvalShown', askId, workflowId)"
    @open-workflow="
      (askId, workflowId, workflowName) =>
        emit('openWorkflow', askId, workflowId, workflowName)
    "
  />
  <AskUserCard
    v-else-if="group.kind === 'askUser'"
    :part="group.part"
    :answering="answeringAskIds.has(group.part.askId)"
    @answer="(askId, answer) => emit('answer', askId, answer)"
  />
  <DeleteApprovalCard
    v-else-if="group.kind === 'deleteApproval'"
    :part="group.part"
    :answering="answeringAskIds.has(group.part.askId)"
    @answer="
      (askId, selection) => emit('answer', askId, { selected: [selection] })
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
