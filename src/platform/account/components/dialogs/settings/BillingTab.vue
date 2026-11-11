<template>
  <div class="flex flex-col gap-12 pt-7 pb-6" data-testid="billing-tab">
    <WorkspaceHeaderMenu />
    <BillingBanner
      v-if="isPaused"
      :view="pausedView(capabilities.canManageBilling.value)"
      :copy="bannerCopy"
      :loading="isUpdatingPayment"
      @action="updatePayment"
    />
    <BillingBanner
      v-if="planCheckout.banner.value"
      :view="planCheckoutBannerView(planCheckout.banner.value, bannerCopy)"
      :copy="bannerCopy"
      @dismiss="planCheckout.dismiss"
    />
    <BillingBanner
      v-if="topupCheckout.banner.value"
      :view="
        topupCheckoutBannerView(
          topupCheckout.banner.value,
          topupBannerCopy,
          capabilities.canTopUp.value
        )
      "
      :copy="topupBannerCopy"
      :add-credits-variant="addCreditsVariant"
      @dismiss="topupCheckout.dismiss"
      @action="addCredits('settings_billing_panel')"
    />
    <BillingBanner
      v-if="
        capabilities.hasParkedBillingOperation.value &&
        capabilities.canManageBilling.value
      "
      :view="parkedView"
      :copy="bannerCopy"
    />
    <BillingStatusBanner section="billing" />
    <BillingBanner
      v-if="creditBanner"
      :view="creditBanner"
      :copy="creditBannerCopy"
      :loading="isUpdatingCreditPayment"
      :add-credits-variant="creditBannerAddCreditsVariant"
      @action="actOnCreditBanner"
      @dismiss="dismissCreditBanner"
    />
    <section class="flex flex-col gap-3" data-testid="billing-plan-section">
      <h2 class="m-0 text-base font-medium text-foreground">
        {{ $t('workspacePanel.billingTab.credits.plan') }}
      </h2>
      <div
        v-if="load === 'loading'"
        class="rounded-xl border border-border px-5 py-4"
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
        class="flex items-center justify-between gap-4 rounded-xl border border-border px-5 py-4"
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
        :action
        :copy="planRowCopy"
        :locale
        :sales-variant="salesVariant"
        :add-credits-variant="addCreditsVariant"
        :can-manage-subscription="capabilities.canManageSubscription.value"
      >
        <template #leading>
          <BillingPlanLifecycle :state="planRow" />
        </template>
        <template #action="{ action: shown, label, variant }">
          <Button
            as="a"
            :href="planActionHref(shown)"
            target="_blank"
            rel="noopener"
            :variant
            size="md"
            class="shrink-0 no-underline"
            @click="trackPlanAction(shown)"
          >
            {{ label }}
            <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
          </Button>
        </template>
      </BillingPlanRow>
    </section>

    <section
      v-if="load === 'ready'"
      class="flex flex-col gap-3"
      data-testid="billing-credits-section"
    >
      <BillingCreditsCard
        :state="creditsCard"
        :add-credits="
          addCreditsAvailability({
            resolved: capabilities.hasResolvedCapabilities.value,
            canTopUp: capabilities.canTopUp.value,
            denial: capabilities.topUpDenial.value
          })
        "
        :add-credits-variant="addCreditsVariant"
        :plan-credit-note="planCreditNote"
        :copy="creditsCardCopy"
        :locale
        @retry="retryBalance"
        @add-credits="addCredits('credits_panel')"
      />
      <BillingAutoTopUpCard
        v-if="autoTopUpSection.kind === 'card'"
        :state="autoTopUpCardState"
        :off-view="autoTopUpOffView"
        :setup="autoTopUpSetup"
        :copy="autoTopUpCardCopy"
        :locale
        :action-href="autoTopUpHref"
        @action="trackAutoTopUp"
        @retry="retryAutoTopUp"
      />
      <BillingAutoTopUpMemberBlock
        v-else-if="autoTopUpSection.kind === 'memberBlock'"
        :copy="autoTopUpMemberCopy"
        :view="autoTopUpMemberView"
        :locale
      />
    </section>

    <div class="flex flex-col gap-6">
      <section class="flex flex-col gap-3" data-testid="billing-handoff">
        <h2 class="m-0 text-base font-medium text-foreground">
          {{ $t(`workspacePanel.billingTab.handoff.${handoffAudience}.label`) }}
        </h2>
        <div
          class="flex items-center gap-4 rounded-xl border border-border px-5 py-4"
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
                class="text-muted-foreground underline hover:text-foreground"
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
            class="ml-auto shrink-0 no-underline"
            @click="trackHandoff"
          >
            {{
              $t(`workspacePanel.billingTab.handoff.${handoffAudience}.action`)
            }}
            <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
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
          class="no-underline"
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
          <i
            class="icon-[lucide--message-circle] size-3.5"
            aria-hidden="true"
          />
          {{ $t('workspacePanel.billingTab.footer.messageSupport') }}
        </Button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { isCloud } from '@/platform/distribution/types'
import { useExternalLink } from '@/composables/useExternalLink'
import { useMessageSupport } from '@/platform/billing/subscription/composables/useSubscriptionActions'
import { useTelemetry } from '@comfyorg/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import WorkspaceHeaderMenu from '@/platform/account/components/dialogs/settings/WorkspaceHeaderMenu.vue'
import BillingStatusBanner from '@/platform/billing/components/settings/BillingStatusBanner.vue'
import { usePlanCheckoutBanner } from '@/platform/billing/composables/usePlanCheckoutBanner'
import BillingPlanLifecycle from '@/platform/billing/components/billingTab/BillingPlanLifecycle.vue'
import {
  addCreditsAvailability,
  addCreditsEmphasis,
  CONTACT_SALES_URL,
  deriveAutoTopUpSection,
  deriveBillingTabLoad,
  planRowAction
} from '@comfyorg/account-core/billing'
import type { PlanRowAction } from '@comfyorg/account-core/billing'
import {
  BillingAutoTopUpCard,
  BillingAutoTopUpMemberBlock,
  BillingBanner,
  BillingCreditsCard,
  BillingPlanRow,
  planCheckoutBannerView,
  suppressesCreditBanners,
  topupCheckoutBannerView
} from '@comfyorg/account-ui/billing'
import { useBillingCreditsCard } from '@/platform/billing/components/billingTab/useBillingCreditsCard'
import { useBillingPlanRow } from '@/platform/billing/components/billingTab/useBillingPlanRow'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useTopUpPlanCreditCopy } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import { usePausedBanner } from '@/platform/billing/composables/usePausedBanner'
import { useTopupCheckoutBanner } from '@/platform/billing/composables/useTopupCheckoutBanner'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'
import { usePlanRowCopy } from '@/platform/billing/composables/usePlanRowCopy'
import { useCreditsCardCopy } from '@/platform/billing/composables/useCreditsCardCopy'
import { useAutoTopUpCardSection } from '@/platform/billing/composables/useAutoTopUpCardSection'
import { useAutoTopUpMemberBlockCopy } from '@/platform/billing/composables/useAutoTopUpCopy'
import { useBillingBannerCopy } from '@/platform/billing/composables/useBillingBannerCopy'
import { useCreditBanner } from '@/platform/billing/composables/useCreditBanner'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const billing = useBillingContext()
const workspaceStore = useTeamWorkspaceStore()
const capabilities = useBillingCapabilities()
const { isPaused } = usePausedBanner()
const planCheckout = usePlanCheckoutBanner()
const topupCheckout = useTopupCheckoutBanner(
  () => capabilities.canManageBilling.value
)
const suppressCreditBanner = computed(() =>
  suppressesCreditBanners([
    ...(isPaused.value ? (['paused'] as const) : []),
    ...(planCheckout.banner.value ? (['planCheckout'] as const) : []),
    ...(topupCheckout.banner.value ? (['topupCheckout'] as const) : [])
  ])
)
const {
  copy: bannerCopy,
  topupCopy: topupBannerCopy,
  pausedView,
  parkedView
} = useBillingBannerCopy()
const { updatePayment, isUpdatingPayment } = usePaymentRecoveryDialog()
const {
  view: creditBanner,
  copy: creditBannerCopy,
  isUpdatingPayment: isUpdatingCreditPayment,
  act: actOnCreditBanner,
  dismiss: dismissCreditBanner
} = useCreditBanner(suppressCreditBanner)
const { state: planRow } = useBillingPlanRow()
const planRowCopy = usePlanRowCopy()
const { locale } = useI18n()
const { state: creditsCard } = useBillingCreditsCard(planRow)
const planCreditNote = useTopUpPlanCreditCopy()
const creditsCardCopy = useCreditsCardCopy()
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
    workspaceLoadFailed: workspaceStore.initState === 'error',
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
const autoTopUpSection = computed(() =>
  deriveAutoTopUpSection({
    autoTopUpEnabled: capabilities.autoTopUpEnabled.value,
    canViewAutoTopUpCard: capabilities.canViewAutoTopUpCard.value,
    canViewAutoTopUpMemberNotice:
      capabilities.canViewAutoTopUpMemberNotice.value
  })
)
const {
  state: autoTopUpCardState,
  offView: autoTopUpOffView,
  setup: autoTopUpSetup,
  copy: autoTopUpCardCopy,
  href: autoTopUpHref,
  track: trackAutoTopUp,
  retry: retryAutoTopUp
} = useAutoTopUpCardSection(
  () => load.value === 'ready' && autoTopUpSection.value.kind === 'card'
)
const autoTopUpMemberCopy = useAutoTopUpMemberBlockCopy()
const autoTopUpMemberView = computed(
  () => capabilities.autoTopUpMemberView.value
)
const salesVariant = computed(() =>
  billing.subscriptionStatus.value === 'ended' ? 'inverted' : 'secondary'
)

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
      action.value === 'subscribe' ||
      (action.value === 'choosePlan' && isCloud) ||
      (action.value === 'contactSales' && salesVariant.value === 'inverted')
  })
)

const creditBannerAddCreditsVariant = computed(() =>
  planRow.value.kind === 'ended' ? 'secondary' : addCreditsVariant.value
)

const { href: handoffHref, track: trackHandoff } = usePlatformHandoff(
  () => HANDOFF[handoffAudience.value].path,
  () => ({ target: HANDOFF[handoffAudience.value].target })
)

const { href: plansHref, track: trackPlans } = usePlatformHandoff(
  '/profile/billing/plans',
  { target: 'plans' }
)

function planActionHref(shown: PlanRowAction) {
  return shown === 'contactSales' ? CONTACT_SALES_URL : plansHref.value
}

function trackPlanAction(shown: PlanRowAction) {
  if (shown !== 'contactSales') trackPlans()
}

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
  if (workspaceStore.initState === 'error') {
    await workspaceStore.initialize().catch(() => undefined)
  }
  await Promise.allSettled([billing.initialize(), capabilities.refresh()])
}

onMounted(() => {
  if (!billing.isInitialized.value && !billing.isLoading.value) {
    void billing.initialize().catch(() => undefined)
  }
  void capabilities.initialize()
})
</script>
