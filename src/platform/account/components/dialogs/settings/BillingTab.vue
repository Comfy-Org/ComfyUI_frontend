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
    <BillingTopupCheckoutBanner
      :banner="topupCheckout.banner.value"
      :can-top-up="capabilities.canTopUp.value"
      :add-credits-variant="addCreditsVariant"
      @dismiss="topupCheckout.dismiss"
      @add-credits="addCredits('settings_billing_panel')"
    />
    <BillingParkedBanner
      :parked="
        capabilities.hasParkedBillingOperation.value &&
        capabilities.canManageBilling.value
      "
    />
    <BillingStatusBanner section="billing" />
    <BillingLocalCreditBanner
      :suppressed="suppressCreditBanner"
      :add-credits-variant="addCreditsVariant"
    />
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
        :top-up-paused="
          capabilities.topUpDenial.value === 'topup_purchases_paused'
        "
        :add-credits-variant="addCreditsVariant"
        :plan-credit-note="planCreditNote"
        @retry="retryBalance"
        @add-credits="addCredits('credits_panel')"
      />
      <template v-if="capabilities.autoTopUpEnabled.value">
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
        class="flex items-center gap-4 rounded-xl border border-card px-5 py-4"
        data-testid="billing-handoff-card"
      >
        <i18n-t
          v-if="handoffAudience === 'owner'"
          keypath="workspacePanel.billingTab.handoff.owner.line"
          tag="p"
          class="m-0 text-sm text-muted-foreground"
        >
          <template #platform>
            <a
              :href="handoffHref"
              target="_blank"
              rel="noopener"
              class="text-muted-foreground underline"
              @click="trackHandoff"
            >
              {{ $t('workspacePanel.billingTab.handoff.owner.platform') }}
            </a>
          </template>
        </i18n-t>
        <Button
          as="a"
          :href="handoffHref"
          target="_blank"
          rel="noopener"
          variant="secondary"
          size="md"
          class="ml-auto shrink-0"
          @click="trackHandoff"
        >
          {{
            $t(`workspacePanel.billingTab.handoff.${handoffAudience}.action`)
          }}
          <i :class="handoffIcon" aria-hidden="true" />
        </Button>
      </div>
    </section>

    <footer class="flex items-center gap-4" data-testid="billing-footer">
      <Button
        as="a"
        :href="partnerNodesPricingHref"
        target="_blank"
        rel="noopener"
        variant="muted-textonly"
        size="md"
      >
        <i class="icon-[lucide--coins] size-3.5" aria-hidden="true" />
        {{ $t('workspacePanel.billingTab.footer.partnerNodesPricing') }}
      </Button>
      <Button
        variant="muted-textonly"
        size="md"
        :loading="isLoadingSupport"
        @click="handleMessageSupport"
      >
        <i class="icon-[lucide--message-circle] size-3.5" aria-hidden="true" />
        {{ $t('workspacePanel.billingTab.footer.messageSupport') }}
      </Button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useExternalLink } from '@/composables/useExternalLink'
import { useMessageSupport } from '@/platform/billing/subscription/composables/useSubscriptionActions'
import { useTelemetry } from '@comfyorg/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import WorkspaceHeaderMenu from '@/platform/account/components/dialogs/settings/WorkspaceHeaderMenu.vue'
import BillingLocalCreditBanner from '@/platform/billing/components/billingTab/BillingLocalCreditBanner.vue'
import BillingPlanCheckoutBanner from '@/platform/billing/components/billingTab/BillingPlanCheckoutBanner.vue'
import BillingParkedBanner from '@/platform/billing/components/billingTab/BillingParkedBanner.vue'
import BillingPausedBanner from '@/platform/billing/components/billingTab/BillingPausedBanner.vue'
import BillingTopupCheckoutBanner from '@/platform/billing/components/billingTab/BillingTopupCheckoutBanner.vue'
import BillingStatusBanner from '@/platform/billing/components/settings/BillingStatusBanner.vue'
import { usePlanCheckoutBanner } from '@/platform/billing/composables/usePlanCheckoutBanner'
import BillingAutoTopUpCard from '@/platform/billing/components/billingTab/BillingAutoTopUpCard.vue'
import BillingCreditsCard from '@/platform/billing/components/billingTab/BillingCreditsCard.vue'
import BillingPlanRow from '@/platform/billing/components/billingTab/BillingPlanRow.vue'
import { addCreditsEmphasis } from '@/platform/billing/components/billingTab/creditsCard'
import {
  deriveBillingTabLoad,
  planRowAction
} from '@/platform/billing/components/billingTab/planRow'
import { useBillingCreditsCard } from '@/platform/billing/components/billingTab/useBillingCreditsCard'
import { useBillingPlanRow } from '@/platform/billing/components/billingTab/useBillingPlanRow'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useTopUpPlanCreditCopy } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import { usePausedBanner } from '@/platform/billing/composables/usePausedBanner'
import { useTopupCheckoutBanner } from '@/platform/billing/composables/useTopupCheckoutBanner'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

const billing = useBillingContext()
const capabilities = useBillingCapabilities()
const { isPaused } = usePausedBanner()
const planCheckout = usePlanCheckoutBanner()
const topupCheckout = useTopupCheckoutBanner(
  () => capabilities.canManageBilling.value
)
const suppressCreditBanner = computed(
  () =>
    isPaused.value ||
    planCheckout.banner.value != null ||
    topupCheckout.banner.value != null
)
const { state: planRow } = useBillingPlanRow()
const { state: creditsCard } = useBillingCreditsCard(planRow)
const planCreditNote = useTopUpPlanCreditCopy()
const { showTopUpCreditsDialog } = useBillingDialogs()
const telemetry = useTelemetry()
const { isLoadingSupport, handleMessageSupport } = useMessageSupport()
const { buildDocsUrl, docsPaths } = useExternalLink()
const partnerNodesPricingHref = computed(() =>
  buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true })
)

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

const { state: autoTopUp } = useBillingAutoTopUpCard()
const addCreditsVariant = computed(() =>
  addCreditsEmphasis({
    availableCents:
      creditsCard.value.kind === 'unavailable'
        ? null
        : creditsCard.value.availableCents,
    canTopUp: capabilities.canTopUp.value,
    autoTopUpStatus:
      autoTopUp.value.kind === 'loaded'
        ? autoTopUp.value.settings.status
        : null,
    planActionIsPrimary:
      action.value === 'subscribe' || action.value === 'choosePlan'
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

function addCredits(source: 'credits_panel' | 'settings_billing_panel') {
  telemetry?.trackAddApiCreditButtonClicked({ source })
  void showTopUpCreditsDialog({
    source: paymentIntentSourceForAddCreditsClick(source)
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
