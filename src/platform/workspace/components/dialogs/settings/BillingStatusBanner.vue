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
          v-else-if="banner.action === 'resubscribe'"
          variant="secondary"
          size="lg"
          @click="handleResubscribePlan"
        >
          {{ $t('workspacePanel.members.resubscribe') }}
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
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useBillingBanner } from '@/platform/workspace/composables/useBillingBanner'
import type {
  BillingBannerAudience,
  BillingBannerKind
} from '@/platform/workspace/composables/useBillingBanner'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { usePlanEnded } from '@/platform/workspace/composables/usePlanEnded'
import { useResubscribe } from '@/platform/workspace/composables/useResubscribe'
import { useScheduledPlanChange } from '@/platform/workspace/composables/useScheduledPlanChange'
import { useWorkspaceTierLabel } from '@/platform/workspace/composables/useWorkspaceTierLabel'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

type BannerAction =
  | 'addCredits'
  | 'reactivate'
  | 'resubscribe'
  | 'contactSales'
  | 'updatePayment'

const { section } = defineProps<{
  section?: 'planCredits' | 'members' | 'allowlist'
}>()

const { t, d } = useI18n()
const { renewalDate, renewalInvoice, subscription, manageSubscription } =
  useBillingContext()
const { permissions, canReactivatePlan, workspaceType } = useWorkspaceUI()
const { canTopUp } = useBillingCapabilities()
const { kind, audience, dismiss } = useBillingBanner()
const { formatTierName } = useWorkspaceTierLabel()
const { isResubscribing, handleResubscribe } = useResubscribe()
const {
  scheduledChange,
  planName: scheduledPlanName,
  isDisplayable: canShowScheduledChange
} = useScheduledPlanChange()
const dialogService = useDialogService()
const subscriptionDialog = useSubscriptionDialog()
const { isSalesManagedPlan, isEnterprisePlan: isEndedEnterprisePlan } =
  usePlanEnded()

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
// "Or wait until credits refill" is only a real option when the refill is
// close. A yearly plan refills at renewal, which can be a year away, so past
// this window the suggestion is dropped. Within it the date never needs a year.
const REFILL_SUGGESTION_WINDOW_MS = 31 * 24 * 60 * 60 * 1000
const nearRefillDate = computed(() => {
  const raw = renewalDate.value
  const date = raw ? new Date(raw) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  if (date.getTime() - Date.now() > REFILL_SUGGESTION_WINDOW_MS) return ''
  return d(date, { month: 'long', day: 'numeric' })
})
const planEndDate = computed(() => longDate(subscription.value?.endDate))
const planName = computed(() => formatTierName(subscription.value?.tier, false))

interface BannerView {
  muted: boolean
  title: string
  body: string
  action: BannerAction | null
  dismissible: boolean
  payInvoiceUrl?: string
}

const bs = 'workspacePanel.billingStatus'

const audienceCopy = {
  team: {
    outOfCreditsBody: `${bs}.outOfCredits.body`,
    outOfCreditsBodyNoDate: `${bs}.outOfCredits.bodyNoDate`,
    endingTitle: `${bs}.ending.title`,
    endingBody: `${bs}.ending.body`
  },
  personal: {
    outOfCreditsBody: `${bs}.outOfCredits.personalBody`,
    outOfCreditsBodyNoDate: `${bs}.outOfCredits.personalBodyNoDate`,
    endingTitle: `${bs}.ending.personalTitle`,
    endingBody: `${bs}.ending.personalBody`
  }
} satisfies Record<BillingBannerAudience, Record<string, string>>

const copy = computed(() => audienceCopy[audience.value ?? 'team'])

const PLAN_LIFECYCLE_KINDS: ReadonlySet<BillingBannerKind> = new Set([
  'planEnded',
  'ending',
  'planChange'
])

// A personal workspace's Members tab carries its own upgrade pitch, so the
// plan lifecycle notices stay on the Plan & Credits tab.
const isHiddenOnSection = computed(
  () =>
    section === 'members' &&
    workspaceType.value === 'personal' &&
    kind.value !== null &&
    PLAN_LIFECYCLE_KINDS.has(kind.value)
)

// Only an https payment page is opened; anything else hides the action.
function safeInvoiceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value).protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

const pausedView = (): BannerView => ({
  muted: !canManage.value,
  title: t(`${bs}.paused.title`),
  body: canManage.value ? t(`${bs}.paused.body`) : t(`${bs}.paused.memberBody`),
  action: canManage.value ? 'updatePayment' : null,
  dismissible: false,
  payInvoiceUrl: safeInvoiceUrl(renewalInvoice.value?.hosted_invoice_url)
})

// Sales-managed plans (Enterprise, and unrecognized tiers, which fail closed
// to sales) return through sales; only a strict ENTERPRISE tier is named.
function planEndedCopy(): {
  title: string
  ownerBody: string
  memberBody: string
} {
  const date = planEndDate.value
  if (audience.value === 'personal') {
    const plan = planName.value
    const body = t(`${bs}.planEnded.personalBody`)
    return {
      title: date
        ? t(`${bs}.planEnded.personalTitle`, { plan, date })
        : t(`${bs}.planEnded.personalTitleNoDate`, { plan }),
      ownerBody: body,
      memberBody: body
    }
  }
  if (!isSalesManagedPlan.value) {
    return {
      title: date
        ? t(`${bs}.planEnded.teamTitle`, { date })
        : t('workspacePanel.members.endedTeamTitle'),
      ownerBody: t(`${bs}.planEnded.teamBody`),
      memberBody: t(`${bs}.planEnded.teamMemberBody`)
    }
  }
  const named = isEndedEnterprisePlan.value
  return {
    title: date
      ? t(`${bs}.planEnded.${named ? 'enterpriseTitle' : 'planTitle'}`, {
          date
        })
      : t(
          `workspacePanel.members.${named ? 'endedEnterpriseTitle' : 'endedPlanTitle'}`
        ),
    ownerBody: t(`${bs}.planEnded.${named ? 'enterpriseBody' : 'salesBody'}`),
    memberBody: t(`${bs}.planEnded.salesMemberBody`)
  }
}

const planEndedView = (): BannerView => {
  const copy = planEndedCopy()
  const ownerAction =
    audience.value !== 'personal' && isSalesManagedPlan.value
      ? 'contactSales'
      : 'resubscribe'
  return {
    muted: true,
    title: copy.title,
    body: canManage.value ? copy.ownerBody : copy.memberBody,
    action: canManage.value ? ownerAction : null,
    dismissible: true
  }
}

const outOfCreditsBody = (key: string, noDateKey: string): string =>
  nearRefillDate.value ? t(key, { date: nearRefillDate.value }) : t(noDateKey)

// An owner who cannot top up only reaches this once the plan has ended, which
// the plan ended notice covers, so that case shows nothing.
const outOfCreditsView = (): BannerView | null => {
  if (!canManage.value) {
    return {
      muted: false,
      title: t(`${bs}.outOfCredits.title`),
      body: outOfCreditsBody(
        `${bs}.outOfCredits.memberBody`,
        `${bs}.outOfCredits.memberBodyNoDate`
      ),
      action: null,
      dismissible: true
    }
  }
  if (!canTopUp.value) return null
  return {
    muted: false,
    title: t(`${bs}.outOfCredits.title`),
    body: outOfCreditsBody(
      copy.value.outOfCreditsBody,
      copy.value.outOfCreditsBodyNoDate
    ),
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

const selfServeEndingView = (): BannerView => ({
  muted: true,
  title: t(copy.value.endingTitle, {
    plan: planName.value,
    date: planEndDate.value
  }),
  body: canManage.value
    ? t(copy.value.endingBody)
    : t(`${bs}.ending.memberBody`),
  action: canManage.value && canReactivatePlan.value ? 'reactivate' : null,
  dismissible: false
})

const endingView = (): BannerView =>
  isEnterprisePlan.value ? enterpriseEndingView() : selfServeEndingView()

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

// Runs are already blocked on payment_failed, so it reads as paused.
const bannerViews: Record<BillingBannerKind, () => BannerView | null> = {
  paused: pausedView,
  paymentFailed: pausedView,
  planEnded: planEndedView,
  outOfCredits: outOfCreditsView,
  ending: endingView,
  planChange: planChangeView
}

const banner = computed<BannerView | null>(() =>
  kind.value && !isHiddenOnSection.value ? bannerViews[kind.value]() : null
)

function handleAddCredits() {
  void dialogService.showTopUpCreditsDialog()
}
function handleResubscribePlan() {
  subscriptionDialog.show({
    planMode: audience.value === 'personal' ? 'personal' : 'team',
    reason: 'settings_billing_panel'
  })
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
