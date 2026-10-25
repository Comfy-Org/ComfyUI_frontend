<template>
  <div class="flex flex-col gap-12" data-testid="billing-tab">
    <WorkspaceHeaderMenu />
    <BillingPausedBanner
      :can-manage-billing="capabilities.canManageBilling.value"
    />
    <BillingPlanCheckoutBanner
      :banner="planCheckout.banner.value"
      @dismiss="planCheckout.dismiss"
    />
    <BillingParkedBanner
      :parked="capabilities.hasParkedBillingOperation.value"
    />
    <BillingLocalCreditBanner :suppressed="suppressCreditBanner" />
    <section class="flex flex-col gap-3" data-testid="billing-plan-section">
      <h2 class="m-0 text-base font-medium text-foreground">
        {{ $t('workspacePanel.billingTab.credits.plan') }}
      </h2>
      <div
        v-if="load === 'loading'"
        class="rounded-xl border border-card px-5 py-4"
        data-testid="billing-plan-skeleton"
        aria-busy="true"
      >
        <div class="flex flex-col gap-2">
          <Skeleton class="h-6 w-1/3" />
          <Skeleton class="h-4 w-2/3" />
        </div>
      </div>
      <div
        v-else-if="load === 'error'"
        class="flex items-center justify-between gap-4 rounded-xl border border-card px-5 py-4"
        role="alert"
        data-testid="billing-load-error"
      >
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('workspacePanel.billingTab.loadError') }}
        </p>
        <Button variant="secondary" size="md" class="shrink-0" @click="retry">
          {{ $t('workspacePanel.billingTab.tryAgain') }}
        </Button>
      </div>
      <BillingPlanRow
        v-else
        :state="planRow"
        :action="action"
        :sales-variant="salesVariant"
        :can-manage-subscription="capabilities.canManageSubscription.value"
        @open-plan="openPlan"
      />
    </section>

    <section
      v-if="load === 'ready'"
      class="flex flex-col gap-3"
      data-testid="billing-credits-section"
    >
      <BillingCreditsCard
        :state="creditsCard"
        :can-top-up="capabilities.canTopUp.value"
        :plan-credit-note="planCreditNote"
        @retry="retryBalance"
        @add-credits="addCredits"
      />
      <template v-if="flags.autoTopUpEnabled">
        <template v-if="capabilities.canManageAutoTopUp.value">
          <BillingAutoTopUpCard v-if="capabilities.canTopUp.value" />
        </template>
      </template>
    </section>

    <section class="flex flex-col gap-3" data-testid="billing-handoff">
      <h2 class="m-0 text-base font-medium text-foreground">
        {{ $t(`workspacePanel.billingTab.handoff.${handoffAudience}.label`) }}
      </h2>
      <div
        class="flex items-center justify-end rounded-xl border border-card px-5 py-4"
        data-testid="billing-handoff-card"
      >
        <Button
          as="a"
          :href="handoffHref"
          target="_blank"
          rel="noopener"
          variant="secondary"
          size="md"
          class="shrink-0"
          @click="trackHandoff"
        >
          {{
            $t(`workspacePanel.billingTab.handoff.${handoffAudience}.action`)
          }}
          <i :class="cn(handoffIcon, 'size-4')" aria-hidden="true" />
        </Button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useSubscriptionPaywall } from '@/platform/billing/composables/useSubscriptionPaywall'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@/platform/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import WorkspaceHeaderMenu from '@/platform/workspace/components/dialogs/settings/WorkspaceHeaderMenu.vue'
import BillingLocalCreditBanner from '@/platform/billing/components/billingTab/BillingLocalCreditBanner.vue'
import BillingPlanCheckoutBanner from '@/platform/billing/components/billingTab/BillingPlanCheckoutBanner.vue'
import BillingParkedBanner from '@/platform/billing/components/billingTab/BillingParkedBanner.vue'
import BillingPausedBanner from '@/platform/billing/components/billingTab/BillingPausedBanner.vue'
import { usePlanCheckoutBanner } from '@/platform/billing/composables/usePlanCheckoutBanner'
import BillingAutoTopUpCard from '@/platform/billing/components/billingTab/BillingAutoTopUpCard.vue'
import BillingCreditsCard from '@/platform/billing/components/billingTab/BillingCreditsCard.vue'
import BillingPlanRow from '@/platform/billing/components/billingTab/BillingPlanRow.vue'
import {
  deriveBillingTabLoad,
  planRowAction
} from '@/platform/billing/components/billingTab/planRow'
import { useBillingCreditsCard } from '@/platform/billing/components/billingTab/useBillingCreditsCard'
import { useBillingPlanRow } from '@/platform/billing/components/billingTab/useBillingPlanRow'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useTopUpPlanCreditCopy } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import { usePausedBanner } from '@/platform/billing/composables/usePausedBanner'
import { usePlatformHandoff } from '@/platform/workspace/composables/usePlatformHandoff'

const billing = useBillingContext()
const capabilities = useBillingCapabilities()
const { isPaused } = usePausedBanner()
const planCheckout = usePlanCheckoutBanner()
const suppressCreditBanner = computed(
  () => isPaused.value || planCheckout.banner.value != null
)
const { flags } = useFeatureFlags()
const { state: planRow } = useBillingPlanRow()
const { state: creditsCard } = useBillingCreditsCard(planRow)
const planCreditNote = useTopUpPlanCreditCopy()
const { showTopUpCreditsDialog } = useBillingDialogs()
const { showSubscriptionDialog } = useSubscriptionPaywall()
const telemetry = useTelemetry()

const HANDOFF = {
  owner: { path: '/profile/billing', target: 'open_billing' },
  member: { path: '/profile/usage', target: 'usage' }
} as const

const handoffAudience = computed(() =>
  capabilities.canManageBilling.value ? 'owner' : 'member'
)

const load = computed(() =>
  deriveBillingTabLoad({
    billingError: billing.error.value,
    billingInitialized: billing.isInitialized.value,
    capabilitiesReady: capabilities.isReady.value,
    capabilitiesResolved: capabilities.hasResolvedCapabilities.value
  })
)

const action = computed(() =>
  planRowAction(planRow.value, {
    canOpenPlans: capabilities.canOpenPlans.value,
    planKind: capabilities.planKind.value
  })
)

const salesVariant = computed(() =>
  billing.subscriptionStatus.value === 'ended' ? 'inverted' : 'secondary'
)

const { href: handoffHref, track: trackHandoff } = usePlatformHandoff(
  () => HANDOFF[handoffAudience.value].path,
  () => ({ target: HANDOFF[handoffAudience.value].target })
)

const handoffIcon = computed(() =>
  handoffAudience.value === 'owner'
    ? 'icon-[lucide--arrow-up-right]'
    : 'icon-[lucide--external-link]'
)

async function retryBalance() {
  await billing.fetchBalance().catch(() => undefined)
}

function openPlan() {
  showSubscriptionDialog({ reason: 'settings_billing_panel' })
}

function addCredits() {
  telemetry?.trackAddApiCreditButtonClicked({ source: 'credits_panel' })
  void showTopUpCreditsDialog({
    source: paymentIntentSourceForAddCreditsClick('credits_panel')
  })
}

async function retry() {
  await Promise.allSettled([billing.initialize(), capabilities.refresh()])
}

onMounted(() => {
  if (!billing.isInitialized.value && !billing.isLoading.value) {
    void billing.initialize().catch(() => undefined)
  }
  void capabilities.initialize()
})
</script>
