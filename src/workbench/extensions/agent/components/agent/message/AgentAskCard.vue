<script setup lang="ts">
import type {
  AgentAskAnswer,
  AskPart
} from '../../../services/agent/agentMessageParts'
import AskUserCard from './AskUserCard.vue'
import RunApprovalCard from './RunApprovalCard.vue'

const { part, answering = false } = defineProps<{
  part: AskPart
  answering?: boolean
}>()

const emit = defineEmits<{
  answer: [askId: string, answer: AgentAskAnswer]
  openWorkflow: [workflowId: string, workflowName?: string]
}>()
</script>

<template>
  <RunApprovalCard
    v-if="part.type === 'runApproval'"
    :part
    :answering
    @answer="
      (askId, selection) => emit('answer', askId, { selected: [selection] })
    "
    @open-workflow="
      (workflowId, workflowName) =>
        emit('openWorkflow', workflowId, workflowName)
    "
  />
  <AskUserCard
    v-else
    :part
    :answering
    @answer="(askId, answer) => emit('answer', askId, answer)"
  />
</template>
