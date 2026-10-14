<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import TagRemoveButton from '@/components/chip/TagRemoveButton.vue'
import Button from '@/components/ui/button/Button.vue'

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
      class="min-w-0"
      @click="open"
    >
      <span aria-hidden="true" class="icon-[comfy--workflow] size-3 shrink-0" />
      <span class="max-w-56 min-w-0 truncate">{{ name }}</span>
    </Button>
    <TagRemoveButton
      :label="t('agent.removeWorkflowReference', { name })"
      @click.stop="emit('remove')"
    />
  </span>
</template>
