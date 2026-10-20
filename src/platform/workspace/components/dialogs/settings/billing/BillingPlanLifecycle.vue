<template>
  <template v-if="canRevertScheduledChange">
    <Button
      v-if="stay"
      variant="secondary"
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

import Button from '@comfyorg/design-system/button/Button'
import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogDescription from '@comfyorg/design-system/dialog/DialogDescription'
import DialogFooter from '@comfyorg/design-system/dialog/DialogFooter'
import DialogHeader from '@comfyorg/design-system/dialog/DialogHeader'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import {
  PLAN_CONFIRM_CLOSED,
  reducePlanConfirm,
  resumeIntent,
  stayIntent
} from '@/platform/workspace/components/dialogs/settings/billing/planLifecycle'
import type {
  PlanConfirmEvent,
  PlanConfirmState,
  PlanLifecycleIntent
} from '@/platform/workspace/components/dialogs/settings/billing/planLifecycle'
import { formatPlanDate } from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import type { PlanRowState } from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import { usePlanLifecycleCommands } from '@/platform/workspace/components/dialogs/settings/billing/usePlanLifecycleCommands'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

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
