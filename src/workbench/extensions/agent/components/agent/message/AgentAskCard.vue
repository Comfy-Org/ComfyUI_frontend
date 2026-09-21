<script setup lang="ts">
import type {
  AgentAskSelection,
  AskPart
} from '../../../services/agent/agentMessageParts'
import PermissionAskCard from './PermissionAskCard.vue'
import RunApprovalCard from './RunApprovalCard.vue'

const { part, answering = false } = defineProps<{
  part: AskPart
  answering?: boolean
}>()

const emit = defineEmits<{
  answer: [askId: string, selection: AgentAskSelection]
  openWorkflow: [workflowId: string, workflowName?: string]
}>()
</script>

<template>
  <RunApprovalCard
    v-if="part.type === 'runApproval'"
    :part
    :answering
    @answer="(askId, selection) => emit('answer', askId, selection)"
    @open-workflow="
      (workflowId, workflowName) =>
        emit('openWorkflow', workflowId, workflowName)
    "
  />
  <PermissionAskCard
    v-else
    :part
    :answering
    @answer="(askId, selection) => emit('answer', askId, selection)"
  />
</template>
