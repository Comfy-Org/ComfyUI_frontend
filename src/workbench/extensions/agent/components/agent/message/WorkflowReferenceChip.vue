<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { WorkflowReference } from '../../../types/workflowReference'

const { reference } = defineProps<{ reference: WorkflowReference }>()
const emit = defineEmits<{ open: [reference: WorkflowReference] }>()
const { t } = useI18n()

function open(): void {
  if (!reference.unavailable) emit('open', reference)
}
</script>

<template>
  <span
    role="button"
    tabindex="0"
    :aria-label="
      reference.unavailable
        ? t('agent.unavailableWorkflowReference', { name: reference.name })
        : t('agent.openWorkflowTab', { name: reference.name })
    "
    data-testid="workflow-reference-chip"
    data-comfy-workflow="1"
    :data-workflow-id="reference.id"
    :data-workflow-unavailable="reference.unavailable ? 'true' : undefined"
    :aria-disabled="reference.unavailable"
    :aria-description="
      reference.unavailable
        ? t('agent.workflowReferenceUnavailableReason')
        : undefined
    "
    :title="
      reference.unavailable
        ? t('agent.workflowReferenceUnavailableReason')
        : undefined
    "
    class="inline cursor-pointer rounded-sm bg-primary-background/30 box-decoration-clone px-1 py-0.5 font-inter text-xs/[15px] font-normal break-all whitespace-normal text-primary-background-hover ring-1 ring-primary-background/30 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-background aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent
    @keyup.space.prevent="open"
    ><span
      class="mr-1 icon-[comfy--workflow] inline-block size-3 align-middle"
    /><span>{{ reference.name }}</span></span
  >
</template>
