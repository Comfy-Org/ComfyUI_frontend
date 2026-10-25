<template>
  <div v-if="banner" class="@container">
    <div
      role="status"
      class="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 @2xl:flex-row @2xl:items-center @2xl:gap-2"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-2">
          <i
            :class="
              cn(
                'shrink-0',
                banner.muted
                  ? 'icon-[lucide--circle-alert] text-muted-foreground'
                  : 'icon-[lucide--triangle-alert] text-warning'
              )
            "
          />
          <span class="text-sm text-foreground">{{ banner.title }}</span>
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
          :data-dd-action-name="BILLING_ACTION_NAME.addCreditsStatusBanner"
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
        <Button
          v-else-if="banner.action === 'updatePayment'"
          variant="inverted"
          size="lg"
          :loading="isUpdatingPayment"
          @click="updatePayment"
        >
          {{ $t('workspacePanel.billingStatus.updatePayment') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { ENTERPRISE_URL } from '@/platform/billing/subscription/constants/tierPricing'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { useBillingBanner } from '@/platform/billing/composables/useBillingBanner'
import type {
  BillingBannerAudience,
  BillingBannerKind
} from '@/platform/billing/composables/useBillingBanner'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import {
  isTopUpDeniedPastDue,
  usePaymentRecoveryDialog
} from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { pausedBannerCopy } from '@/platform/billing/composables/usePausedBanner'
import { usePlanEnded } from '@/platform/billing/composables/usePlanEnded'
import { useResubscribe } from '@/platform/billing/composables/useResubscribe'
import { useScheduledPlanChange } from '@/platform/billing/composables/useScheduledPlanChange'
import { useWorkspaceTierLabel } from '@/platform/billing/composables/useWorkspaceTierLabel'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

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
const { renewalDate, subscription } = useBillingContext()
const { permissions, canReactivatePlan, workspaceType } = useWorkspaceUI()
const { canTopUp, topUpDenial, canManageBilling, runDeniedPaymentPastDue } =
  useBillingCapabilities()
const { kind, audience, dismiss } = useBillingBanner()
const { formatTierName } = useWorkspaceTierLabel()
const { isResubscribing, handleResubscribe } = useResubscribe()
const {
  scheduledChange,
  planName: scheduledPlanName,
  isDisplayable: canShowScheduledChange
} = useScheduledPlanChange()
const { showTopUpCreditsDialog } = useBillingDialogs()
const { updatePayment, isUpdatingPayment } = usePaymentRecoveryDialog()
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
const cycleResetDate = computed(() => longDate(renewalDate.value))
const planEndDate = computed(() => longDate(subscription.value?.endDate))
const planName = computed(() => formatTierName(subscription.value?.tier, false))

interface BannerView {
  muted: boolean
  title: string
  body: string
  action: BannerAction | null
  dismissible: boolean
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
  cycleResetDate.value ? t(key, { date: cycleResetDate.value }) : t(noDateKey)

const pausedView = (): BannerView => {
  const paused = pausedBannerCopy(canManageBilling.value)
  return {
    muted: paused.muted,
    title: t(paused.titleKey),
    body: t(paused.bodyKey),
    action: paused.action,
    dismissible: false
  }
}

function pastDueBodyKey(): string {
  if (audience.value === 'personal')
    return `${bs}.outOfCredits.pastDuePersonalBody`
  return canManageBilling.value
    ? `${bs}.outOfCredits.pastDueBody`
    : `${bs}.outOfCredits.pastDueMemberBody`
}

const pastDueView = (): BannerView => ({
  muted: false,
  title: t(`${bs}.outOfCredits.title`),
  body: t(pastDueBodyKey()),
  action: canManageBilling.value ? 'updatePayment' : null,
  dismissible: true
})

const outOfCreditsView = (): BannerView | null => {
  if (runDeniedPaymentPastDue.value) return pastDueView()
  if (isTopUpDeniedPastDue(topUpDenial.value)) return pastDueView()
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

const bannerViews: Record<BillingBannerKind, () => BannerView | null> = {
  paused: pausedView,
  planEnded: planEndedView,
  outOfCredits: outOfCreditsView,
  ending: endingView,
  planChange: planChangeView
}

const banner = computed<BannerView | null>(() =>
  kind.value && !isHiddenOnSection.value ? bannerViews[kind.value]() : null
)

function handleAddCredits() {
  void showTopUpCreditsDialog()
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
</script>
