<script setup lang="ts">
import { formatPeriodEnd } from '@churnkey/react/core'
import type { CancelFlowMachine } from '@churnkey/react/core'
import { computed, onUnmounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import SanitizedHtml from '@/components/common/SanitizedHtml.vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import ChurnkeyFlowSurvey from './ChurnkeyFlowSurvey.vue'
import ChurnkeyFlowActions from './ChurnkeyFlowActions.vue'

const { machine, onClose, canCancel, pendingMessage } = defineProps<{
  machine: CancelFlowMachine
  onClose: () => void
  canCancel: () => boolean
  pendingMessage: () => string | undefined
}>()
const { t, locale } = useI18n()
const state = shallowRef(machine.getSnapshot())
const unsubscribe = machine.subscribe(() => {
  state.value = machine.getSnapshot()
})
onUnmounted(unsubscribe)
const step = computed(() => {
  state.value
  return machine.currentStep
})
const offer = computed(() => {
  state.value
  return machine.currentOffer
})
const reasons = computed(() => {
  state.value
  return machine.reasons
})
const periodEnd = computed(() =>
  formatPeriodEnd(state.value.subscriptions, locale.value)
)
const busy = computed(() => state.value.isProcessing)
const blocked = computed(() => {
  state.value
  return !canCancel()
})
const body = computed(
  () => offer.value?.copy.body ?? step.value?.description ?? ''
)
const selectedReason = computed(() =>
  reasons.value.find((reason) => reason.id === state.value.selectedReason)
)
function surveyComplete() {
  return Boolean(
    state.value.selectedReason &&
    (!selectedReason.value?.freeform || state.value.followupResponse.trim())
  )
}
function feedbackComplete() {
  if (step.value?.type !== 'feedback') return true
  return (
    !step.value.required ||
    state.value.feedback.trim().length >= (step.value.minLength ?? 1)
  )
}
const canContinue = computed(() => {
  switch (state.value.step) {
    case 'survey':
      return surveyComplete()
    case 'feedback':
      return feedbackComplete()
    default:
      return true
  }
})
const disabled = computed(() => busy.value || blocked.value)
const heading = computed(
  () =>
    offer.value?.copy.headline ??
    step.value?.title ??
    t('subscription.cancelDialog.title')
)
const feedbackPlaceholder = computed(() =>
  step.value?.type === 'feedback' ? step.value.placeholder : undefined
)
const errorMessage = computed(() =>
  blocked.value ? pendingMessage() : state.value.error?.message
)
const successMessage = computed(() =>
  t(
    state.value.outcome === 'saved'
      ? 'subscription.cancelDialog.retentionSuccess'
      : 'subscription.cancelSuccess'
  )
)
function feedback(value: string | number | undefined) {
  machine.setFeedback(String(value ?? ''))
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4 text-base-foreground">
    <template v-if="state.step === 'success'">
      <p role="status">{{ successMessage }}</p>
      <Button @click="onClose">{{ t('g.close') }}</Button>
    </template>
    <template v-else>
      <h3 class="m-0 text-lg font-semibold">{{ heading }}</h3>
      <SanitizedHtml
        v-if="body"
        class="text-sm text-muted-foreground"
        :html="body"
      />
      <ChurnkeyFlowSurvey
        v-if="state.step === 'survey'"
        :machine
        :state
        :disabled
      />
      <Textarea
        v-if="state.step === 'feedback'"
        :model-value="state.feedback"
        :aria-label="t('subscription.cancelDialog.additionalFeedback')"
        :placeholder="feedbackPlaceholder"
        :disabled
        @update:model-value="feedback"
      />
      <p v-if="state.error" role="alert" class="text-error">
        {{ errorMessage }}
      </p>
      <p v-if="busy" role="status">
        {{ t('subscription.cancelDialog.retentionBusy') }}
      </p>
      <p v-if="periodEnd" class="text-sm text-muted-foreground">
        {{ t('subscription.cancelDialog.description', { date: periodEnd }) }}
      </p>
      <ChurnkeyFlowActions
        :machine
        :state
        :disabled
        :blocked
        :can-continue="canContinue"
        :on-close="onClose"
      />
    </template>
  </div>
</template>
