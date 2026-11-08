<script setup lang="ts">
import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import type {
  AgentPaywallPresentation,
  AgentPaywallRemediation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import AgentPausedCard from './AgentPausedCard.vue'
import AskUserCard from './AskUserCard.vue'
import DeleteApprovalCard from './DeleteApprovalCard.vue'
import RunApprovalCard from './RunApprovalCard.vue'
import type { AskGroup } from './agentMessageGroup'

const { group } = defineProps<{
  group: AskGroup
  answering: boolean
  paywallPresentation: AgentPaywallPresentation
}>()

const emit = defineEmits<{
  answer: [askId: string, answer: AgentAnswerRequest]
  openWorkflow: [askId: string, workflowId: string, workflowName?: string]
  approvalShown: [askId: string, workflowId: string | null]
  paywallAction: [action: AgentPaywallRemediation]
}>()

function answerSelection(askId: string, selection: string): void {
  emit('answer', askId, { selected: [selection] })
}
</script>

<template>
  <RunApprovalCard
    v-if="group.kind === 'runApproval'"
    :part="group.part"
    :answering
    @answer="answerSelection"
    @shown="(askId, workflowId) => emit('approvalShown', askId, workflowId)"
    @open-workflow="
      (askId, workflowId, workflowName) =>
        emit('openWorkflow', askId, workflowId, workflowName)
    "
  />
  <AskUserCard
    v-else-if="group.kind === 'askUser'"
    :part="group.part"
    :answering
    @answer="(askId, answer) => emit('answer', askId, answer)"
  />
  <DeleteApprovalCard
    v-else-if="group.kind === 'deleteApproval'"
    :part="group.part"
    :answering
    @answer="answerSelection"
  />
  <AgentPausedCard
    v-else
    :part="group.part"
    :presentation="paywallPresentation"
    :answering
    @answer="answerSelection"
    @paywall-action="emit('paywallAction', $event)"
  />
</template>
