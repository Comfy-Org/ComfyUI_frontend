<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import InlineReferenceRemoveButton from './InlineReferenceRemoveButton.vue'
import { inlineReferenceChipClass } from './inlineReferenceChipStyles'

const { name, unavailable = false } = defineProps<{
  name: string
  unavailable?: boolean
}>()
const emit = defineEmits<{ open: []; remove: [] }>()
const { t } = useI18n()

function open(): void {
  if (!unavailable) emit('open')
}
</script>

<template>
  <span :class="inlineReferenceChipClass">
    <Button
      type="button"
      variant="textonly"
      size="sm"
      :aria-label="
        unavailable
          ? t('agent.unavailableWorkflowReference', { name })
          : t('agent.openWorkflowTab', { name })
      "
      :aria-disabled="unavailable || undefined"
      :aria-description="
        unavailable ? t('agent.workflowReferenceUnavailableReason') : undefined
      "
      :title="
        unavailable ? t('agent.workflowReferenceUnavailableReason') : undefined
      "
      class="h-auto min-w-0 gap-1 p-0 font-normal hover:bg-transparent aria-disabled:cursor-not-allowed"
      @click="open"
    >
      <i aria-hidden="true" class="icon-[comfy--workflow] size-3" />
      <span class="max-w-56 min-w-0 truncate">{{ name }}</span>
    </Button>
    <InlineReferenceRemoveButton
      :label="t('agent.removeWorkflowReference', { name })"
      @remove="emit('remove')"
    />
  </span>
</template>
