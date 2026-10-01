<template>
  <div v-if="banner" class="@container">
    <div
      role="status"
      class="flex flex-col gap-3 rounded-2xl border border-interface-stroke/60 bg-base-background p-4 @2xl:flex-row @2xl:items-center @2xl:gap-2"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-2">
          <i
            :class="
              cn(
                'size-4 shrink-0',
                banner.muted
                  ? 'icon-[lucide--circle-alert] text-muted-foreground'
                  : 'icon-[lucide--triangle-alert] text-warning-background'
              )
            "
          />
          <span class="text-sm text-base-foreground">{{ banner.title }}</span>
        </div>
        <p class="m-0 pl-6 text-sm text-muted-foreground">{{ banner.body }}</p>
      </div>
      <div
        v-if="banner.dismissible || banner.action"
        class="flex shrink-0 flex-wrap items-center gap-2 pl-6 @2xl:pl-0"
      >
        <Button
          v-if="banner.dismissible"
          variant="textonly"
          size="lg"
          @click="dismiss"
        >
          {{ $t('workspacePanel.billingStatus.outOfCredits.dismiss') }}
        </Button>
        <Button
          v-if="banner.action === 'addCredits'"
          variant="secondary"
          size="lg"
          @click="handleAddCredits"
        >
          {{ $t('workspacePanel.billingStatus.outOfCredits.addCredits') }}
        </Button>
        <Button
          v-else-if="banner.action === 'reactivate'"
          variant="secondary"
          size="lg"
          :loading="isResubscribing"
          @click="handleResubscribe"
        >
          {{ $t('workspacePanel.billingStatus.ending.reactivate') }}
        </Button>
        <Button
          v-else-if="banner.action === 'contactSales'"
          variant="secondary"
          size="lg"
          @click="handleContactSales"
        >
          {{ $t('workspacePanel.billingStatus.ending.contactSales') }}
        </Button>
        <template v-else-if="banner.action === 'updatePayment'">
          <Button
            v-if="banner.payInvoiceUrl"
            variant="inverted"
            size="lg"
            @click="handlePayInvoice(banner.payInvoiceUrl)"
          >
            {{ $t('workspacePanel.billingStatus.payInvoice') }}
          </Button>
          <Button
            :variant="banner.payInvoiceUrl ? 'secondary' : 'inverted'"
            size="lg"
            @click="handleUpdatePayment"
          >
            {{ $t('workspacePanel.billingStatus.updatePayment') }}
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { ENTERPRISE_URL } from '@/platform/cloud/subscription/constants/tierPricing'
import { useBillingBanner } from '@/platform/workspace/composables/useBillingBanner'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useResubscribe } from '@/platform/workspace/composables/useResubscribe'
import { useScheduledPlanChange } from '@/platform/workspace/composables/useScheduledPlanChange'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

type BannerAction =
  | 'addCredits'
  | 'reactivate'
  | 'contactSales'
  | 'updatePayment'

const { t, d } = useI18n()
const { renewalDate, renewalInvoice, subscription, manageSubscription } =
  useBillingContext()
const { permissions, canReactivatePlan } = useWorkspaceUI()
const { canTopUp } = useBillingCapabilities()
const { kind, dismiss } = useBillingBanner()
const { isResubscribing, handleResubscribe } = useResubscribe()
const {
  scheduledChange,
  planName: scheduledPlanName,
  isDisplayable: canShowScheduledChange
} = useScheduledPlanChange()
const dialogService = useDialogService()

const canManage = computed(() => permissions.value.canManageSubscription)
// Strictly ENTERPRISE: an unrecognized tier must not borrow Enterprise copy
// (isUnknownTier's contract) nor lose its Reactivate path.
const isEnterprisePlan = computed(
  () => subscription.value?.tier === 'ENTERPRISE'
)
function longDate(raw: string | null | undefined): string {
  const date = raw ? new Date(raw) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return d(date, { year: 'numeric', month: 'long', day: 'numeric' })
}
const cycleResetDate = computed(() => longDate(renewalDate.value))
const planEndDate = computed(() => longDate(subscription.value?.endDate))

interface BannerView {
  muted: boolean
  title: string
  body: string
  action: BannerAction | null
  dismissible: boolean
  payInvoiceUrl?: string
}

const bs = 'workspacePanel.billingStatus'

const pausedView = (): BannerView => ({
  muted: !canManage.value,
  title: t(`${bs}.paused.title`),
  body: canManage.value ? t(`${bs}.paused.body`) : t(`${bs}.paused.memberBody`),
  action: canManage.value ? 'updatePayment' : null,
  dismissible: false
})

// Only an https payment page is opened; anything else hides the action.
function safeInvoiceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value).protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

// Runs are already blocked on payment_failed; reads as paused until BE-6970.
const paymentFailedView = (): BannerView => ({
  ...pausedView(),
  payInvoiceUrl: safeInvoiceUrl(renewalInvoice.value?.hosted_invoice_url)
})

const outOfCreditsBody = (key: 'body' | 'memberBody'): string =>
  cycleResetDate.value
    ? t(`${bs}.outOfCredits.${key}`, { date: cycleResetDate.value })
    : t(`${bs}.outOfCredits.${key}NoDate`)

// An owner who cannot top up only reaches this once the plan has ended, which
// the plan ended notice covers, so that case shows nothing.
const outOfCreditsView = (): BannerView | null => {
  if (!canManage.value) {
    return {
      muted: false,
      title: t(`${bs}.outOfCredits.title`),
      body: outOfCreditsBody('memberBody'),
      action: null,
      dismissible: true
    }
  }
  if (!canTopUp.value) return null
  return {
    muted: false,
    title: t(`${bs}.outOfCredits.title`),
    body: outOfCreditsBody('body'),
    action: 'addCredits',
    dismissible: true
  }
}

// An Enterprise contract renews through sales, not self-serve reactivation,
// so it gets its own copy and never a Reactivate action — even where the
// legacy rail would resolve canReactivatePlan true.
const enterpriseEndingView = (): BannerView => ({
  muted: true,
  title: t(`${bs}.ending.enterpriseTitle`, { date: planEndDate.value }),
  body: canManage.value
    ? t(`${bs}.ending.enterpriseBody`)
    : t(`${bs}.ending.memberBody`),
  action: canManage.value ? 'contactSales' : null,
  dismissible: false
})

const teamEndingView = (): BannerView => ({
  muted: true,
  title: t(`${bs}.ending.title`, { date: planEndDate.value }),
  body: canManage.value ? t(`${bs}.ending.body`) : t(`${bs}.ending.memberBody`),
  action: canManage.value && canReactivatePlan.value ? 'reactivate' : null,
  dismissible: false
})

const endingView = (): BannerView =>
  isEnterprisePlan.value ? enterpriseEndingView() : teamEndingView()

const planChangeView = (): BannerView | null =>
  canShowScheduledChange.value
    ? {
        muted: true,
        title: t(`${bs}.planChange.title`, {
          plan: scheduledPlanName.value,
          date: longDate(scheduledChange.value?.effective_at)
        }),
        body: t(`${bs}.planChange.body`),
        action: null,
        dismissible: true
      }
    : null

const banner = computed<BannerView | null>(() => {
  switch (kind.value) {
    case 'paused':
      return pausedView()
    case 'paymentFailed':
      return paymentFailedView()
    case 'outOfCredits':
      return outOfCreditsView()
    case 'ending':
      return endingView()
    case 'planChange':
      return planChangeView()
    default:
      return null
  }
})

function handleAddCredits() {
  void dialogService.showTopUpCreditsDialog()
}
function handleContactSales() {
  window.open(ENTERPRISE_URL, '_blank', 'noopener,noreferrer')
}
function handlePayInvoice(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
function handleUpdatePayment() {
  void manageSubscription()
}
</script>
