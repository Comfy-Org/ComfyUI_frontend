<script setup lang="ts">
import type { CancelFlowMachine, FlowState } from '@churnkey/react/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'

const { machine, state, disabled } = defineProps<{
  machine: CancelFlowMachine
  state: FlowState
  disabled: boolean
}>()
const { t } = useI18n()
const selectedReason = computed(() =>
  machine.reasons.find((reason) => reason.id === state.selectedReason)
)
function followup(value: string | number | undefined) {
  machine.setFollowupResponse(String(value ?? ''))
}
</script>

<template>
  <div
    class="flex flex-col gap-2"
    role="group"
    :aria-label="t('subscription.cancelDialog.title')"
  >
    <Button
      v-for="reason in machine.reasons"
      :key="reason.id"
      :variant="state.selectedReason === reason.id ? 'primary' : 'secondary'"
      :disabled
      :aria-pressed="state.selectedReason === reason.id"
      @click="machine.selectReason(reason.id)"
    >
      {{ reason.label }}
    </Button>
    <Textarea
      v-if="selectedReason?.freeform"
      :model-value="state.followupResponse"
      :aria-label="t('subscription.cancelDialog.additionalFeedback')"
      :disabled
      @update:model-value="followup"
    />
  </div>
</template>
