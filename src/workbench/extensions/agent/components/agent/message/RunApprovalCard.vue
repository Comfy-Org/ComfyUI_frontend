<script setup lang="ts">
import Card from '@comfyorg/design-system/card/Card'
import { computed, inject, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import { formatCreditsRangeValue } from '@comfyorg/shared-frontend-utils/nodePricing'

import type { RunApprovalPart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import {
  agentBoundWorkflowActiveKey,
  agentBoundWorkflowIdKey
} from '@/workbench/extensions/agent/components/agent/agentBoundWorkflowId'
import { useRunCostEstimate } from '@/workbench/extensions/agent/composables/useRunCostEstimate'

const { part, answering = false } = defineProps<{
  part: RunApprovalPart
  answering?: boolean
}>()
const boundWorkflowId = inject(agentBoundWorkflowIdKey, ref(undefined))
const boundWorkflowActive = inject(agentBoundWorkflowActiveKey, ref(false))
const hideWorkflowName = computed(
  () => !!boundWorkflowId.value && part.workflowId === boundWorkflowId.value
)
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

// Priced off the canvas, so only the ask for the workflow on canvas gets a
// figure. See useRunCostEstimate.
const isEstimable = computed(
  () => hideWorkflowName.value && boundWorkflowActive.value
)
const estimate = useRunCostEstimate(isEstimable)

/**
 * What the user needs before approving a spend: a ball-park figure that can
 * only be too low. Every figure is a floor — cloud GPU time is not priced
 * anywhere yet — so the copy says "at least" even at full api-node coverage.
 *
 * Three cases, and the third is why this is not just a sum. Something priced:
 * show the floor. Nothing priced but cost-bearing nodes present: say the
 * estimate is unavailable, because silence would read as free. No api nodes
 * at all: stay silent — the run still costs GPU time, so "0 credits" would be
 * a worse answer than none.
 */
const costLine = computed(() => {
  const read = estimate.value
  if (!read) return null
  if (read.pricedCount > 0)
    return t('agent.runApproval.estimateAtLeast', {
      credits: formatCreditsRangeValue(read.minUsd, read.maxUsd)
    })
  if (read.perUnit.length + read.unpriced.length > 0)
    return t('agent.runApproval.estimateUnavailable')
  return null
})
</script>

<template>
  <Card
    surface="secondary"
    class="flex w-full flex-col gap-2 overflow-hidden p-4 shadow-md"
  >
    <div class="flex min-w-0 flex-col gap-0.5 text-sm/5">
      <p class="m-0">
        {{
          t(
            hideWorkflowName
              ? 'agent.runApproval.leadBound'
              : 'agent.runApproval.lead'
          )
        }}
      </p>
      <ul
        v-if="!hideWorkflowName"
        class="m-0 min-w-0 list-disc pl-5 text-muted-foreground"
      >
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
      <p
        v-if="costLine"
        class="m-0 text-muted-foreground"
        data-testid="run-approval-cost"
      >
        {{ costLine }}
      </p>
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
  </Card>
</template>
