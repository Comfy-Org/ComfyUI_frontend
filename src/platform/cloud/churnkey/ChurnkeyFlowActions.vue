<script setup lang="ts">
import type { CancelFlowMachine, FlowState } from '@churnkey/react/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { machine, state, disabled, blocked, canContinue, onClose } =
  defineProps<{
    machine: CancelFlowMachine
    state: FlowState
    disabled: boolean
    blocked: boolean
    canContinue: boolean
    onClose: () => void
  }>()
const { t } = useI18n()
const acceptLabel = computed(() => {
  state.currentStepId
  return blocked
    ? t('subscription.cancelDialog.retryDiscount')
    : machine.currentOffer?.copy.cta
})
const declineLabel = computed(() => {
  state.currentStepId
  return machine.currentOffer?.copy.declineCta
})
const nextDisabled = computed(() => disabled || !canContinue)
const showNext = computed(() => state.step !== 'confirm')
</script>

<template>
  <div class="flex flex-wrap justify-end gap-2">
    <Button
      variant="muted-textonly"
      :disabled="state.isProcessing"
      @click="onClose"
      >{{ t('subscription.cancelDialog.keepSubscription') }}</Button
    >
    <Button
      v-if="machine.canGoBack"
      variant="secondary"
      :disabled
      @click="machine.back()"
      >{{ t('g.back') }}</Button
    >
    <template v-if="state.step === 'offer'">
      <Button variant="secondary" :disabled @click="machine.decline()">{{
        declineLabel
      }}</Button>
      <Button :loading="state.isProcessing" @click="machine.accept()">{{
        acceptLabel
      }}</Button>
    </template>
    <Button
      v-else-if="showNext"
      :disabled="nextDisabled"
      @click="machine.next()"
      >{{ t('g.next') }}</Button
    >
    <Button
      variant="destructive"
      :loading="state.isProcessing"
      :disabled="blocked"
      @click="machine.cancel()"
      >{{ t('subscription.cancelDialog.confirmCancel') }}</Button
    >
  </div>
</template>
