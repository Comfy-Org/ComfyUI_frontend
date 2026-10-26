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

  <Dialog :open="confirm.phase !== 'closed'" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent
        v-if="confirm.phase !== 'closed'"
        size="sm"
        data-testid="billing-plan-confirm"
      >
        <DialogHeader>
          <DialogTitle>{{ copy.title }}</DialogTitle>
          <DialogClose :aria-label="$t('g.close')" />
        </DialogHeader>
        <div class="flex flex-col gap-2 px-4 py-2">
          <DialogDescription>{{ copy.body }}</DialogDescription>
          <p
            v-if="confirm.phase === 'refused'"
            role="alert"
            class="m-0 text-sm wrap-break-word text-destructive"
          >
            {{
              confirm.serverMessage ??
              $t('workspacePanel.billingTab.plan.lifecycleRefused')
            }}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            :loading="confirm.phase === 'submitting'"
            @click="submit"
          >
            {{ copy.confirm }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import {
  PLAN_CONFIRM_CLOSED,
  reducePlanConfirm,
  resumeIntent,
  stayIntent
} from '@/platform/billing/components/billingTab/planLifecycle'
import type {
  PlanConfirmEvent,
  PlanConfirmState,
  PlanLifecycleIntent
} from '@/platform/billing/components/billingTab/planLifecycle'
import { formatPlanDate } from '@/platform/billing/components/billingTab/planRow'
import type { PlanRowState } from '@/platform/billing/components/billingTab/planRow'
import { usePlanLifecycleCommands } from '@/platform/billing/components/billingTab/usePlanLifecycleCommands'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

const { state } = defineProps<{ state: PlanRowState }>()

const { t, locale } = useI18n()
const { canRevertScheduledChange, canReactivate } = useBillingCapabilities()
const { revertScheduledChange, resumePlan } = usePlanLifecycleCommands()

const confirm = shallowRef<PlanConfirmState>(PLAN_CONFIRM_CLOSED)

const stay = computed(() => stayIntent(state))
const resume = computed(() => resumeIntent(state))

function dispatch(event: PlanConfirmEvent) {
  confirm.value = reducePlanConfirm(confirm.value, event)
}

function copyFor(intent: PlanLifecycleIntent) {
  const key = 'workspacePanel.billingTab.plan'
  if (intent.kind === 'stay') {
    return {
      title: t(`${key}.stayConfirm.title`, { plan: intent.targetPlanName }),
      body: t(`${key}.stayConfirm.body`, {
        plan: intent.targetPlanName,
        date: formatPlanDate(intent.effectiveAt, locale.value, null)
      }),
      confirm: t(`${key}.actions.stay`, { plan: intent.planName })
    }
  }
  return {
    title: t(`${key}.resumeConfirm.title`, { plan: intent.planName }),
    body: t(`${key}.resumeConfirm.body`, {
      date: formatPlanDate(intent.renewsAt, locale.value, null)
    }),
    confirm: t(`${key}.actions.resume`)
  }
}

const copy = computed(() =>
  confirm.value.phase === 'closed'
    ? { title: '', body: '', confirm: '' }
    : copyFor(confirm.value.intent)
)

function onOpenChange(open: boolean) {
  if (!open) dispatch({ type: 'dismissed' })
}

async function submit() {
  const current = confirm.value
  if (current.phase !== 'confirming' && current.phase !== 'refused') return
  dispatch({ type: 'submitted' })
  const outcome =
    current.intent.kind === 'stay'
      ? await revertScheduledChange()
      : await resumePlan()
  dispatch({ type: 'settled', outcome })
}
</script>
