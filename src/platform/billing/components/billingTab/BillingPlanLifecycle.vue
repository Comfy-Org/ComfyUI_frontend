<template>
  <template v-if="canRevertScheduledChange">
    <Button
      v-if="stay"
      variant="secondary"
      size="md"
      class="shrink-0"
      @click="dispatch({ type: 'opened', intent: stay })"
    >
      {{
        $t('workspacePanel.billingTab.plan.actions.stay', {
          plan: stay.planName
        })
      }}
    </Button>
  </template>
  <template v-if="canReactivate">
    <Button
      v-if="resume"
      variant="secondary"
      size="md"
      class="shrink-0"
      @click="dispatch({ type: 'opened', intent: resume })"
    >
      {{ $t('workspacePanel.billingTab.plan.actions.resume') }}
    </Button>
  </template>

  <BillingPlanConfirmDialog v-model="confirm" :run="runIntent" />
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import {
  PLAN_CONFIRM_CLOSED,
  reducePlanConfirm,
  resumeIntent,
  stayIntent
} from '@comfyorg/account-core/billing'
import type {
  PlanConfirmEvent,
  PlanConfirmState,
  PlanLifecycleIntent,
  PlanRowState
} from '@comfyorg/account-core/billing'
import BillingPlanConfirmDialog from '@/platform/billing/components/billingTab/BillingPlanConfirmDialog.vue'
import { usePlanLifecycleCommands } from '@/platform/billing/components/billingTab/usePlanLifecycleCommands'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

const { state } = defineProps<{ state: PlanRowState }>()

const { canRevertScheduledChange, canReactivate } = useBillingCapabilities()
const { revertScheduledChange, resumePlan } = usePlanLifecycleCommands()

const confirm = shallowRef<PlanConfirmState>(PLAN_CONFIRM_CLOSED)

const stay = computed(() => stayIntent(state))
const resume = computed(() => resumeIntent(state))

function dispatch(event: PlanConfirmEvent) {
  confirm.value = reducePlanConfirm(confirm.value, event)
}

function runIntent(intent: PlanLifecycleIntent) {
  return intent.kind === 'stay' ? revertScheduledChange() : resumePlan()
}
</script>
