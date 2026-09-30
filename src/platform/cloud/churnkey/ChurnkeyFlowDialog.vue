<script setup lang="ts">
import { formatPeriodEnd } from '@churnkey/react/core'
import type { CancelFlowMachine } from '@churnkey/react/core'
import { computed, onUnmounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import SanitizedHtml from '@/components/common/SanitizedHtml.vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'

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
const canContinue = computed(() => {
  if (state.value.step === 'survey')
    return Boolean(
      state.value.selectedReason &&
      (!selectedReason.value?.freeform || state.value.followupResponse.trim())
    )
  if (state.value.step === 'feedback' && step.value?.type === 'feedback')
    return (
      !step.value.required ||
      state.value.feedback.trim().length >= (step.value.minLength ?? 1)
    )
  return true
})
function feedback(value: string | number | undefined) {
  machine.setFeedback(String(value ?? ''))
}
function followup(value: string | number | undefined) {
  machine.setFollowupResponse(String(value ?? ''))
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4 text-base-foreground">
    <template v-if="state.step === 'success'">
      <p role="status">
        {{
          t(
            state.outcome === 'saved'
              ? 'subscription.cancelDialog.retentionSuccess'
              : 'subscription.cancelSuccess'
          )
        }}
      </p>
      <Button @click="onClose">{{ t('g.close') }}</Button>
    </template>
    <template v-else>
      <h3 class="m-0 text-lg font-semibold">
        {{
          offer?.copy.headline ??
          step?.title ??
          t('subscription.cancelDialog.title')
        }}
      </h3>
      <SanitizedHtml
        v-if="body"
        class="text-sm text-muted-foreground"
        :html="body"
      />
      <div
        v-if="state.step === 'survey'"
        class="flex flex-col gap-2"
        role="group"
        :aria-label="step?.title ?? t('subscription.cancelDialog.title')"
      >
        <Button
          v-for="reason in reasons"
          :key="reason.id"
          :variant="
            state.selectedReason === reason.id ? 'primary' : 'secondary'
          "
          :disabled="busy || blocked"
          :aria-pressed="state.selectedReason === reason.id"
          @click="machine.selectReason(reason.id)"
        >
          {{ reason.label }}
        </Button>
        <Textarea
          v-if="selectedReason?.freeform"
          :model-value="state.followupResponse"
          :aria-label="t('subscription.cancelDialog.additionalFeedback')"
          :disabled="busy || blocked"
          @update:model-value="followup"
        />
      </div>
      <Textarea
        v-if="state.step === 'feedback'"
        :model-value="state.feedback"
        :aria-label="t('subscription.cancelDialog.additionalFeedback')"
        :placeholder="step?.type === 'feedback' ? step.placeholder : undefined"
        :disabled="busy || blocked"
        @update:model-value="feedback"
      />
      <p v-if="state.error" role="alert" class="text-error">
        {{ blocked ? pendingMessage() : state.error.message }}
      </p>
      <p v-if="busy" role="status">
        {{ t('subscription.cancelDialog.retentionBusy') }}
      </p>
      <p v-if="periodEnd" class="text-sm text-muted-foreground">
        {{ t('subscription.cancelDialog.description', { date: periodEnd }) }}
      </p>
      <div class="flex flex-wrap justify-end gap-2">
        <Button variant="muted-textonly" :disabled="busy" @click="onClose">{{
          t('subscription.cancelDialog.keepSubscription')
        }}</Button>
        <Button
          v-if="machine.canGoBack"
          variant="secondary"
          :disabled="busy || blocked"
          @click="machine.back()"
          >{{ t('g.back') }}</Button
        >
        <template v-if="state.step === 'offer'">
          <Button
            variant="secondary"
            :disabled="busy || blocked"
            @click="machine.decline()"
            >{{ offer?.copy.declineCta }}</Button
          >
          <Button :loading="busy" @click="machine.accept()">{{
            blocked
              ? t('subscription.cancelDialog.retryDiscount')
              : offer?.copy.cta
          }}</Button>
        </template>
        <Button
          v-else-if="state.step !== 'confirm'"
          :disabled="busy || blocked || !canContinue"
          @click="machine.next()"
          >{{ t('g.next') }}</Button
        >
        <Button
          variant="destructive"
          :loading="busy"
          :disabled="blocked"
          @click="machine.cancel()"
          >{{ t('subscription.cancelDialog.confirmCancel') }}</Button
        >
      </div>
    </template>
  </div>
</template>
