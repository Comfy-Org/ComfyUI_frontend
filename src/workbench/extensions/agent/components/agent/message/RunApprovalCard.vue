<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type { RunApprovalPart } from '../../../services/agent/agentMessageParts'

const { part, answering = false } = defineProps<{
  part: RunApprovalPart
  answering?: boolean
}>()
const emit = defineEmits<{
  answer: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [workflowId: string, workflowName?: string]
}>()

const { t } = useI18n()
const workflowLabel = computed(
  () =>
    part.workflowName?.trim() ||
    part.workflowId?.trim() ||
    t('agent.runApproval.thisWorkflow')
)
</script>

<template>
  <div
    class="border-agent-border bg-agent-surface-raised flex w-full flex-col gap-2 overflow-hidden rounded-lg border p-4 shadow-[0_4px_12px_-1px_rgb(0_0_0/10%)]"
  >
    <div class="flex min-w-0 flex-col gap-0.5 text-sm/5">
      <p class="text-agent-fg m-0 font-medium">
        {{ t('agent.runApproval.lead') }}
      </p>
      <ul class="text-agent-fg-muted m-0 min-w-0 list-disc pl-5">
        <li>
          <button
            v-if="part.workflowId"
            type="button"
            class="hover:text-agent-fg focus-visible:ring-agent-accent max-w-full cursor-pointer border-0 bg-transparent p-0 text-left font-normal wrap-break-word text-inherit underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            @click="emit('openWorkflow', part.workflowId, part.workflowName)"
          >
            {{ workflowLabel }}
          </button>
          <span v-else class="wrap-break-word underline underline-offset-2">
            {{ workflowLabel }}
          </span>
        </li>
      </ul>
      <p class="text-agent-fg-muted m-0">
        {{ t('agent.runApproval.question') }}
      </p>
    </div>

    <div class="flex h-6 w-full justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        :disabled="answering"
        :aria-busy="answering || undefined"
        @click="emit('answer', part.askId, 'cancel')"
      >
        {{ t('agent.runApproval.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="sm"
        :disabled="answering"
        :aria-busy="answering || undefined"
        @click="emit('answer', part.askId, 'run')"
      >
        {{ t('agent.runApproval.run') }}
      </Button>
    </div>
  </div>
</template>
