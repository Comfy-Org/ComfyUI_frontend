<template>
  <section
    class="flex items-start justify-between gap-4 rounded-xl border border-card px-5 py-4"
    data-testid="billing-plan-row"
  >
    <div class="flex min-w-0 flex-col gap-1">
      <h3 class="m-0 text-sm font-semibold wrap-break-word text-foreground">
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
        v-if="action === 'contactSales'"
        as="a"
        :href="CONTACT_SALES_URL"
        target="_blank"
        rel="noopener"
        :variant="salesVariant"
        class="shrink-0 no-underline"
      >
        {{ $t('workspacePanel.billingTab.plan.actions.contactSales') }}
        <i class="icon-[lucide--external-link]" aria-hidden="true" />
      </Button>
      <Button
        v-else-if="action"
        as="a"
        :href="plansHref"
        target="_blank"
        rel="noopener"
        :variant="
          action === 'manage' || addCreditsVariant === 'inverted'
            ? 'secondary'
            : 'inverted'
        "
        size="md"
        class="shrink-0 no-underline"
        @click="trackPlans"
      >
        {{ $t(`workspacePanel.billingTab.plan.actions.${action}`) }}
        <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import BillingPlanLifecycle from '@/platform/billing/components/billingTab/BillingPlanLifecycle.vue'
import {
  CONTACT_SALES_URL,
  formatPlanDate
} from '@/platform/billing/components/billingTab/planRow'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'
import type {
  PlanRowAction,
  PlanRowState
} from '@/platform/billing/components/billingTab/planRow'

const {
  state,
  action,
  canManageSubscription,
  salesVariant = 'secondary',
  addCreditsVariant = 'secondary'
} = defineProps<{
  state: PlanRowState
  action: PlanRowAction | null
  canManageSubscription: boolean
  salesVariant?: 'inverted' | 'secondary'
  addCreditsVariant?: 'inverted' | 'secondary'
}>()

const { href: plansHref, track: trackPlans } = usePlatformHandoff(
  '/profile/billing/plans',
  { target: 'plans' }
)

const { t, locale } = useI18n()

const title = computed(() => {
  if (state.kind === 'noPlan') {
    return t('workspacePanel.billingTab.plan.noPlan.title')
  }
  if (state.kind === 'unknown') {
    return t('workspacePanel.billingTab.plan.unknown.title')
  }
  if (state.kind === 'ended') {
    return state.planName ?? t('workspacePanel.billingTab.plan.unknown.title')
  }
  if (state.kind === 'salesManaged') {
    return (
      state.planName ?? t('workspacePanel.billingTab.plan.salesManaged.title')
    )
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

function endedLine(state: Extract<PlanRowState, { kind: 'ended' }>) {
  const key = 'workspacePanel.billingTab.plan'
  if (!state.endedAt) return t(`${key}.endedNoDate`)
  return t(`${key}.ended`, {
    date: formatPlanDate(state.endedAt, locale.value, state.cadence)
  })
}

const statusLine = computed(() => {
  const key = 'workspacePanel.billingTab.plan'
  if (state.kind === 'activating') {
    return t(`${key}.activating`, { plan: state.planName })
  }
  if (state.kind === 'active') return activeLine(state)
  if (state.kind === 'paused') return t(`${key}.paused`)
  if (state.kind === 'noPlan') return noPlanLine(state)
  if (state.kind === 'salesManaged') {
    return state.renewsAt
      ? t(`${key}.salesManaged.renews`, {
          date: formatPlanDate(state.renewsAt, locale.value, state.cadence)
        })
      : t(`${key}.salesManaged.line`)
  }
  if (state.kind === 'ending') {
    return t(`${key}.ending`, {
      date: formatPlanDate(state.endsAt, locale.value, state.cadence)
    })
  }
  if (state.kind === 'ended') return endedLine(state)
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
