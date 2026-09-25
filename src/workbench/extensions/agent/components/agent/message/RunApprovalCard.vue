<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type { RunApprovalPart } from '../../../services/agent/agentMessageParts'

const { part, answering = false } = defineProps<{
  part: RunApprovalPart
  answering?: boolean
}>()
const emit = defineEmits<{
  answer: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [askId: string, workflowId: string, workflowName?: string]
  shown: [askId: string, workflowId: string | null]
}>()

onMounted(() => emit('shown', part.askId, part.workflowId ?? null))

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
    class="flex w-full flex-col gap-2 overflow-hidden rounded-lg border border-component-node-border bg-secondary-background p-4 shadow-interface"
  >
    <div class="flex min-w-0 flex-col gap-0.5 text-sm/5">
      <p class="m-0 font-medium text-base-foreground">
        {{ t('agent.runApproval.lead') }}
      </p>
      <ul class="m-0 min-w-0 list-disc pl-5 text-muted-foreground">
        <li>
          <Button
            v-if="part.workflowId"
            type="button"
            variant="link"
            size="unset"
            class="max-w-full justify-start text-left font-normal wrap-break-word whitespace-normal text-inherit underline underline-offset-2"
            @click="
              emit(
                'openWorkflow',
                part.askId,
                part.workflowId,
                part.workflowName
              )
            "
          >
            {{ workflowLabel }}
          </Button>
          <span v-else class="wrap-break-word underline underline-offset-2">
            {{ workflowLabel }}
          </span>
        </li>
      </ul>
      <p class="m-0 text-muted-foreground">
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
