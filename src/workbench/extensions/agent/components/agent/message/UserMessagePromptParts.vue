<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Tag from '@comfyorg/design-system/chip/Tag'

import CatalogSkillReference from '@/workbench/extensions/agent/components/agent/CatalogSkillReference.vue'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'
import type { promptReferenceParts } from '@/workbench/extensions/agent/utils/promptReferenceParts'

const { parts } = defineProps<{
  parts: ReturnType<typeof promptReferenceParts>
}>()

const emit = defineEmits<{
  openReferenceWorkflow: [workflowId: string, workflowName: string]
}>()

const { t } = useI18n()

function workflowTagAttrs(reference: WorkflowReference) {
  const unavailableReason = reference.unavailable
    ? t('agent.workflowReferenceUnavailableReason')
    : undefined
  return {
    label: reference.name,
    'aria-label': reference.unavailable
      ? t('agent.unavailableWorkflowReference', { name: reference.name })
      : t('agent.openWorkflowTab', { name: reference.name }),
    'data-workflow-id': reference.id,
    'data-workflow-unavailable': reference.unavailable ? 'true' : undefined,
    'aria-disabled': reference.unavailable,
    'aria-description': unavailableReason,
    title: unavailableReason
  }
}

function openReference(reference: WorkflowReference): void {
  if (reference.unavailable) return
  emit('openReferenceWorkflow', reference.id, reference.name)
}
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <Tag
      v-if="part.type === 'workflow'"
      interactive
      class="-my-0.5 max-w-64 align-middle"
      data-testid="workflow-reference-chip"
      data-comfy-workflow="1"
      v-bind="workflowTagAttrs(part.reference)"
      @click="openReference(part.reference)"
    >
      <template #icon>
        <i aria-hidden="true" class="icon-[comfy--workflow] size-3" />
      </template>
    </Tag>
    <CatalogSkillReference
      v-else-if="part.type === 'skill'"
      :skill="part.reference"
    />
    <template v-else>{{ part.text }}</template>
  </template>
</template>
