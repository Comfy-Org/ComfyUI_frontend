<template>
  <div class="flex flex-col gap-6" data-testid="billing-tab">
    <WorkspaceHeaderMenu />
    <BillingPausedBanner
      :can-manage-billing="capabilities.canManageBilling.value"
    />
    <div
      v-if="load === 'loading'"
      class="flex flex-col gap-2"
      data-testid="billing-plan-skeleton"
      aria-busy="true"
    >
      <Skeleton class="h-6 w-1/3" />
      <Skeleton class="h-4 w-2/3" />
    </div>
    <div
      v-else-if="load === 'error'"
      class="flex items-center justify-between gap-4"
      role="alert"
      data-testid="billing-load-error"
    >
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.billingTab.loadError') }}
      </p>
      <Button variant="secondary" class="shrink-0" @click="retry">
        {{ $t('workspacePanel.billingTab.tryAgain') }}
      </Button>
    </div>
    <template v-else>
      <BillingPlanRow
        :state="planRow"
        :action="action"
        :can-manage-subscription="capabilities.canManageSubscription.value"
        @open-plan="openPlan"
      />
      <BillingCreditsCard
        :state="creditsCard"
        :can-top-up="capabilities.canTopUp.value"
        @retry="retryBalance"
        @add-credits="addCredits"
      />
      <template v-if="flags.autoTopUpEnabled">
        <template v-if="capabilities.canManageAutoTopUp.value">
          <BillingAutoTopUpCard v-if="capabilities.canTopUp.value" />
        </template>
      </template>
    </template>

    <section
      class="flex items-center justify-between gap-4"
      data-testid="billing-handoff"
    >
      <span class="text-sm wrap-break-word text-muted-foreground">
        {{ $t(`workspacePanel.billingTab.handoff.${handoffAudience}.label`) }}
      </span>
      <Button
        as="a"
        :href="handoffHref"
        target="_blank"
        rel="noopener"
        variant="secondary"
        class="shrink-0"
        @click="trackHandoff"
      >
        {{ $t(`workspacePanel.billingTab.handoff.${handoffAudience}.action`) }}
        <i class="icon-[lucide--external-link] size-4" aria-hidden="true" />
      </Button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import { useSubscriptionPaywall } from '@/composables/billing/useSubscriptionPaywall'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@/platform/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import WorkspaceHeaderMenu from '@/platform/workspace/components/dialogs/settings/WorkspaceHeaderMenu.vue'
import BillingPausedBanner from '@/platform/workspace/components/dialogs/settings/billing/BillingPausedBanner.vue'
import BillingAutoTopUpCard from '@/platform/workspace/components/dialogs/settings/billing/BillingAutoTopUpCard.vue'
import BillingCreditsCard from '@/platform/workspace/components/dialogs/settings/billing/BillingCreditsCard.vue'
import BillingPlanRow from '@/platform/workspace/components/dialogs/settings/billing/BillingPlanRow.vue'
import {
  deriveBillingTabLoad,
  planRowAction
} from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import { useBillingCreditsCard } from '@/platform/workspace/components/dialogs/settings/billing/useBillingCreditsCard'
import { useBillingPlanRow } from '@/platform/workspace/components/dialogs/settings/billing/useBillingPlanRow'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/workspace/composables/usePlatformHandoff'

const billing = useBillingContext()
const capabilities = useBillingCapabilities()
const { flags } = useFeatureFlags()
const { state: planRow } = useBillingPlanRow()
const { state: creditsCard } = useBillingCreditsCard(planRow)
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
    canSubscribeSelfServe: capabilities.canSubscribeSelfServe.value
  })
)

const { href: handoffHref, track: trackHandoff } = usePlatformHandoff(
  () => HANDOFF[handoffAudience.value].path,
  () => ({ target: HANDOFF[handoffAudience.value].target })
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
