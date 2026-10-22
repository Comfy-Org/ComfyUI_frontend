<template>
  <section
    class="flex items-start justify-between gap-4"
    data-testid="billing-plan-row"
  >
    <div class="flex min-w-0 flex-col gap-1">
      <h3 class="m-0 text-base font-semibold wrap-break-word text-foreground">
        {{ title }}
      </h3>
      <p
        v-if="line"
        class="m-0 text-sm wrap-break-word text-muted-foreground"
        data-testid="billing-plan-line"
      >
        {{ line }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <BillingPlanLifecycle :state />
      <Button
        v-if="action"
        as="a"
        :href="plansUrl"
        target="_blank"
        rel="noopener"
        :variant="action === 'manage' ? 'secondary' : 'inverted'"
        class="shrink-0"
      >
        {{ $t(`workspacePanel.billingTab.plan.actions.${action}`) }}
        <i class="icon-[lucide--external-link] size-4" aria-hidden="true" />
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import BillingPlanLifecycle from '@/platform/workspace/components/dialogs/settings/billing/BillingPlanLifecycle.vue'
import { formatPlanDate } from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import type {
  PlanRowAction,
  PlanRowState
} from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import { platformLink } from '@/platform/workspace/utils/platformLink'

const { state, action, canManageSubscription } = defineProps<{
  state: PlanRowState
  action: PlanRowAction | null
  canManageSubscription: boolean
}>()

const { t, locale } = useI18n()

const plansUrl = computed(() => platformLink('/profile/billing/plans'))

const title = computed(() => {
  if (state.kind === 'noPlan') {
    return t('workspacePanel.billingTab.plan.noPlan.title')
  }
  if (state.kind === 'unknown') {
    return t('workspacePanel.billingTab.plan.unknown.title')
  }
  return state.planName
})

function activeLine(state: Extract<PlanRowState, { kind: 'active' }>) {
  const key = 'workspacePanel.billingTab.plan'
  const billed = t(`${key}.active.${state.cadence}`, {
    date: formatPlanDate(state.nextInvoice, locale.value, state.cadence)
  })
  if (!state.scheduledChange) return billed
  const change = t(`${key}.scheduledChange`, {
    plan: state.scheduledChange.planName,
    date: formatPlanDate(
      state.scheduledChange.effectiveAt,
      locale.value,
      state.cadence
    )
  })
  return `${billed} ${change}`
}

function noPlanLine(state: Extract<PlanRowState, { kind: 'noPlan' }>) {
  const key = 'workspacePanel.billingTab.plan.noPlan'
  if (!canManageSubscription) return ''
  if (!state.freeRuns) return t(`${key}.line`)
  const { remaining, total } = state.freeRuns
  return remaining > 0
    ? t(`${key}.freeRunsLeft`, { remaining, total })
    : t(`${key}.freeRunsUsed`, { total })
}

const statusLine = computed(() => {
  const key = 'workspacePanel.billingTab.plan'
  if (state.kind === 'activating') {
    return t(`${key}.activating`, { plan: state.planName })
  }
  if (state.kind === 'active') return activeLine(state)
  if (state.kind === 'noPlan') return noPlanLine(state)
  if (state.kind === 'ending') {
    return t(`${key}.ending`, {
      date: formatPlanDate(state.endsAt, locale.value, state.cadence)
    })
  }
  if (state.kind === 'ended') {
    return t(`${key}.ended`, {
      date: formatPlanDate(state.endedAt, locale.value, state.cadence)
    })
  }
  return ''
})

const line = computed(() =>
  canManageSubscription
    ? statusLine.value
    : [statusLine.value, t('workspacePanel.billingTab.plan.managedByOwner')]
        .filter(Boolean)
        .join(' ')
)
</script>
