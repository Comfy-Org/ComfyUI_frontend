<template>
  <CancellationSurveyStep
    v-if="step === 'survey' && surveyId"
    :survey-id="surveyId"
    :experiment-variant="flow?.experiment_variant"
    :on-exit="onSurveyExit"
  />
  <RetentionOfferStep
    v-else-if="step === 'offer' && offerSession"
    v-bind="offerSession"
    :is-scope-current="isScopeCurrent"
    :on-decide="onOfferDecision"
  />
  <CancelSubscriptionDialogContent
    v-else
    :cancel-at="cancelAt"
    :is-scope-current="isScopeCurrent"
    flow-already-opened
  />
</template>

<script setup lang="ts">
import type { RetentionFlowResponse } from '@comfyorg/ingest-types'
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import CancelSubscriptionDialogContent from '@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import CancellationSurveyStep from '@/platform/cloud/subscription/components/CancellationSurveyStep.vue'
import RetentionOfferStep from '@/platform/cloud/subscription/components/RetentionOfferStep.vue'
import { recordRetentionFlowEvent } from '@/platform/cloud/subscription/launchCancellationFlow'
import type { CancellationSurveyExit } from '@/platform/cloud/subscription/utils/cancellationSurvey'
import type { RetentionOfferOutcome } from '@/platform/cloud/subscription/utils/retentionOffer'
import {
  createCancelFlowReporter,
  getSubscriptionCancellationMetadata
} from '@/platform/cloud/subscription/utils/subscriptionCancellationTelemetry'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'

type CancellationFlowStep = 'survey' | 'offer' | 'confirm'

const { cancelAt, surveyId, flow, workspaceId, isScopeCurrent } = defineProps<{
  cancelAt?: string
  surveyId?: string
  flow: RetentionFlowResponse | null
  workspaceId: string | null
  isScopeCurrent: () => boolean
}>()

const { t } = useI18n()
const dialogStore = useDialogStore()
const telemetry = useTelemetry()
const { subscription, tier } = useBillingContext()

const offerSession =
  flow?.offer && workspaceId
    ? {
        offer: flow.offer,
        subscription: flow.subscription,
        sessionId: flow.session_id,
        workspaceId
      }
    : null
const stepAfterSurvey: CancellationFlowStep = offerSession ? 'offer' : 'confirm'
const step = shallowRef<CancellationFlowStep>(
  surveyId ? 'survey' : stepAfterSurvey
)

const cancelReport = createCancelFlowReporter(telemetry, () => ({
  duration: subscription.value?.duration,
  tier: tier.value
}))
let keptByOffer = false

function cancellationMetadata() {
  return getSubscriptionCancellationMetadata({
    cancelAt,
    duration: subscription.value?.duration,
    endDate: subscription.value?.endDate,
    tier: tier.value
  })
}

onMounted(() => {
  if (flow) void recordRetentionFlowEvent(flow.session_id, 'flow_opened')
  telemetry?.trackSubscriptionCancellation(
    'flow_opened',
    cancellationMetadata()
  )
  cancelReport.intent()
})

onUnmounted(() => {
  if (step.value === 'confirm' || keptByOffer) return
  telemetry?.trackSubscriptionCancellation('abandoned', cancellationMetadata())
  cancelReport.abandoned()
})

function closeFlow() {
  dialogStore.closeDialog({ key: 'cancel-subscription' })
}

function onSurveyExit(exit: CancellationSurveyExit) {
  if (exit === 'continue_cancelling') {
    step.value = stepAfterSurvey
    return
  }
  closeFlow()
}

function onOfferDecision(outcome: RetentionOfferOutcome) {
  if (outcome === 'continueToCancel') {
    step.value = 'confirm'
    return
  }
  keptByOffer = outcome === 'retained' || outcome === 'pending'
  if (outcome === 'pending')
    useToastStore().add({
      severity: 'warn',
      summary: t('subscription.retentionOffer.pendingToast'),
      life: 10000
    })
  closeFlow()
}
</script>
