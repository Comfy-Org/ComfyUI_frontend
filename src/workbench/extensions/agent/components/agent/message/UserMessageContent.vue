<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Tag from '@/components/chip/Tag.vue'

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
    <Tag
      v-if="part.type === 'workflow'"
      interactive
      :label="part.reference.name"
      class="max-w-64 align-middle"
      :aria-label="referenceLabel(part.reference)"
      data-testid="workflow-reference-chip"
      data-comfy-workflow="1"
      :data-workflow-id="part.reference.id"
      :data-workflow-unavailable="unavailableData(part.reference)"
      :aria-disabled="part.reference.unavailable"
      :aria-description="unavailableReason(part.reference)"
      :title="unavailableReason(part.reference)"
      @click="openReference(part.reference)"
    >
      <template #icon>
        <span class="icon-[comfy--workflow] size-3 shrink-0" />
      </template>
    </Tag>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
