<template>
  <div class="flex flex-col gap-6" data-testid="billing-tab">
    <WorkspaceHeaderMenu />
    <div
      v-if="isPaused"
      role="status"
      class="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:gap-2"
      data-testid="billing-paused-banner"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-2">
          <i
            :class="
              cn(
                'size-4 shrink-0',
                paused.muted
                  ? 'icon-[lucide--circle-alert] text-muted-foreground'
                  : 'icon-[lucide--triangle-alert] text-warning'
              )
            "
          />
          <span class="text-sm text-foreground">{{ $t(paused.titleKey) }}</span>
        </div>
        <p class="m-0 pl-6 text-sm text-muted-foreground">
          {{ $t(paused.bodyKey) }}
        </p>
      </div>
      <Button
        v-if="paused.action === 'updatePayment'"
        variant="inverted"
        size="lg"
        class="shrink-0"
        :loading="isUpdatingPayment"
        @click="updatePayment"
      >
        {{ $t('workspacePanel.billingStatus.updatePayment') }}
      </Button>
    </div>
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
        :href="handoffUrl"
        target="_blank"
        rel="noopener"
        variant="secondary"
        class="shrink-0"
      >
        {{ $t(`workspacePanel.billingTab.handoff.${handoffAudience}.action`) }}
        <i class="icon-[lucide--external-link] size-4" aria-hidden="true" />
      </Button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@/platform/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import WorkspaceHeaderMenu from '@/platform/workspace/components/dialogs/settings/WorkspaceHeaderMenu.vue'
import BillingAutoTopUpCard from '@/platform/workspace/components/dialogs/settings/billing/BillingAutoTopUpCard.vue'
import BillingCreditsCard from '@/platform/workspace/components/dialogs/settings/billing/BillingCreditsCard.vue'
import BillingPlanRow from '@/platform/workspace/components/dialogs/settings/billing/BillingPlanRow.vue'
import {
  deriveBillingTabLoad,
  planRowAction
} from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import { useBillingCreditsCard } from '@/platform/workspace/components/dialogs/settings/billing/useBillingCreditsCard'
import { useBillingPlanRow } from '@/platform/workspace/components/dialogs/settings/billing/useBillingPlanRow'
import {
  pausedBannerCopy,
  useBillingBanner
} from '@/platform/workspace/composables/useBillingBanner'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { usePaymentRecoveryDialog } from '@/platform/workspace/composables/usePaymentRecoveryDialog'
import { platformLink } from '@/platform/workspace/utils/platformLink'

const billing = useBillingContext()
const capabilities = useBillingCapabilities()
const { flags } = useFeatureFlags()
const { state: planRow } = useBillingPlanRow()
const { state: creditsCard } = useBillingCreditsCard(planRow)
const { showTopUpCreditsDialog } = useBillingDialogs()
const telemetry = useTelemetry()
const { kind: bannerKind } = useBillingBanner()
const { updatePayment, isUpdatingPayment } = usePaymentRecoveryDialog()

const isPaused = computed(() => bannerKind.value === 'paused')
const paused = computed(() =>
  pausedBannerCopy(capabilities.canManageBilling.value)
)

const HANDOFF_PATH = {
  owner: '/profile/billing',
  member: '/profile/usage'
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

const handoffUrl = computed(() =>
  platformLink(HANDOFF_PATH[handoffAudience.value])
)

async function retryBalance() {
  await billing.fetchBalance().catch(() => undefined)
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
