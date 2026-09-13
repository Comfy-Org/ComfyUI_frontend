<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { WorkflowReference } from '../../../types/workflowReference'
import { workflowReferenceParts } from '../../../utils/workflowReferenceParts'

const { text, workflowReferences = [] } = defineProps<{
  text: string
  workflowReferences?: WorkflowReference[]
}>()
const emit = defineEmits<{
  openReferenceWorkflow: [workflowId: string, workflowName: string]
}>()

const { t } = useI18n()
const promptParts = computed(() =>
  workflowReferenceParts(text, workflowReferences)
)

function unavailableData(reference: WorkflowReference): 'true' | undefined {
  return reference.unavailable ? 'true' : undefined
}

function referenceLabel(reference: WorkflowReference): string {
  return reference.unavailable
    ? t('agent.unavailableWorkflowReference', { name: reference.name })
    : t('agent.openWorkflowTab', { name: reference.name })
}

function unavailableReason(reference: WorkflowReference): string | undefined {
  return reference.unavailable
    ? t('agent.workflowReferenceUnavailableReason')
    : undefined
}

function openReference(reference: WorkflowReference): void {
  if (reference.unavailable) return
  emit('openReferenceWorkflow', reference.id, reference.name)
}
</script>

<template>
  <template v-for="(part, index) in promptParts" :key="index">
    <span
      v-if="part.type === 'workflow'"
      role="button"
      tabindex="0"
      :aria-label="referenceLabel(part.reference)"
      data-testid="workflow-reference-chip"
      data-comfy-workflow="1"
      :data-workflow-id="part.reference.id"
      :data-workflow-unavailable="unavailableData(part.reference)"
      :aria-disabled="part.reference.unavailable"
      :aria-description="unavailableReason(part.reference)"
      :title="unavailableReason(part.reference)"
      class="inline cursor-pointer rounded-sm bg-primary-background/30 box-decoration-clone px-1 py-0.5 font-inter text-xs/[15px] font-normal break-all whitespace-normal text-primary-background-hover ring-1 ring-primary-background/30 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-background aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      @click="openReference(part.reference)"
      @keydown.enter.prevent="openReference(part.reference)"
      @keydown.space.prevent
      @keyup.space.prevent="openReference(part.reference)"
    >
      <span
        class="mr-1 icon-[comfy--workflow] inline-block size-3 align-middle"
      />
      <span>{{ part.reference.name }}</span>
    </span>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
