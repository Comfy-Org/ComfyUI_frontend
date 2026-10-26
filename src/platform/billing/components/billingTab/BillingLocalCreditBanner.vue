<template>
  <BillingAutoTopUpBanner v-if="autoTopUpKind" :kind="autoTopUpKind">
    <Button
      as="a"
      :href
      target="_blank"
      rel="noopener"
      variant="inverted"
      size="md"
      class="shrink-0"
      @click="track"
    >
      {{ $t('workspacePanel.billingStatus.updatePayment') }}
    </Button>
  </BillingAutoTopUpBanner>
  <div
    v-else-if="banner"
    class="@container"
    data-testid="billing-local-credit-banner"
  >
    <div
      role="status"
      class="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3 @2xl:flex-row @2xl:items-center @2xl:gap-2"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex items-center gap-2">
          <i
            class="icon-[lucide--triangle-alert] size-4 shrink-0 text-warning"
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
          size="md"
          @click="dismiss"
        >
          {{ $t('workspacePanel.billingStatus.outOfCredits.dismiss') }}
        </Button>
        <Button
          v-if="banner.action === 'addCredits'"
          variant="secondary"
          size="md"
          @click="handleAddCredits"
        >
          {{ $t('workspacePanel.billingStatus.outOfCredits.addCredits') }}
        </Button>
        <Button
          v-else-if="banner.action === 'updatePayment'"
          variant="inverted"
          size="md"
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
import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import BillingAutoTopUpBanner from '@/platform/billing/components/billingTab/BillingAutoTopUpBanner.vue'
import { useAutoTopUpBannerKind } from '@/platform/billing/composables/useAutoTopUpBannerKind'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { deriveLocalCreditBanner } from '@/platform/billing/composables/deriveLocalCreditBanner'
import {
  isTopUpDeniedPastDue,
  usePaymentRecoveryDialog
} from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { usePlatformHandoff } from '@/platform/workspace/composables/usePlatformHandoff'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

type BannerAction = 'addCredits' | 'updatePayment'

interface BannerView {
  title: string
  body: string
  action: BannerAction | null
  dismissible: boolean
}

const bs = 'workspacePanel.billingStatus'

const { suppressed = false } = defineProps<{
  suppressed?: boolean
}>()

const billing = useBillingContext()
const { flags } = useFeatureFlags()
const { permissions } = useWorkspaceUI()
const { canTopUp, topUpDenial, canManageBilling } = useBillingCapabilities()
const { showTopUpCreditsDialog } = useBillingDialogs()
const { updatePayment, isUpdatingPayment } = usePaymentRecoveryDialog()
const { t, d, locale } = useI18n()

const outOfCreditsDismissed = ref(false)
const lowCreditsDismissed = ref(false)

const subscription = computed(() => billing.subscription?.value ?? null)
const balance = computed(() => billing.balance?.value ?? null)
const isTeamPlan = computed(() => billing.isTeamPlan?.value ?? false)

const autoTopUp = useAutoTopUpBannerKind()
const { href, track } = usePlatformHandoff('/profile/billing', {
  target: 'auto_top_up',
  action: 'update_payment'
})

const kind = computed(() => {
  if (suppressed) return null
  if (isCloud && autoTopUp.value) return autoTopUp.value
  return deriveLocalCreditBanner({
    autoTopUp: autoTopUp.value,
    unifiedBillingSettingsEnabled: flags.unifiedBillingSettingsEnabled,
    isCloud,
    isActive: subscription.value?.isActive === true,
    hasFunds: subscription.value?.hasFunds ?? null,
    lowBalance: balance.value?.lowBalance,
    outOfCreditsDismissed: outOfCreditsDismissed.value,
    lowCreditsDismissed: lowCreditsDismissed.value
  })
})

const autoTopUpKind = computed(() =>
  kind.value === 'autoTopUpFailed' || kind.value === 'autoTopUpOff'
    ? kind.value
    : null
)

watch(
  () => subscription.value?.hasFunds === false,
  (exhausted) => {
    if (!exhausted) outOfCreditsDismissed.value = false
  }
)

watch(
  () => balance.value?.lowBalance === true,
  (low) => {
    if (!low) lowCreditsDismissed.value = false
  }
)

const availableCents = computed(() => {
  const current = balance.value
  if (!current) return null
  return current.effectiveBalanceMicros ?? current.amountMicros
})

watch(availableCents, (cents, previous) => {
  if (previous != null && cents !== previous) lowCreditsDismissed.value = false
})

const audience = computed(() => (isTeamPlan.value ? 'team' : 'personal'))

function longDate(raw: string | null | undefined): string {
  const date = raw ? new Date(raw) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return d(date, { year: 'numeric', month: 'long', day: 'numeric' })
}

const cycleResetDate = computed(() =>
  longDate(billing.renewalDate?.value ?? null)
)

function datedBody(key: string, noDateKey: string): string {
  return cycleResetDate.value
    ? t(key, { date: cycleResetDate.value })
    : t(noDateKey)
}

function pastDueBodyKey(): string {
  if (audience.value === 'personal') {
    return `${bs}.outOfCredits.pastDuePersonalBody`
  }
  return canManageBilling.value
    ? `${bs}.outOfCredits.pastDueBody`
    : `${bs}.outOfCredits.pastDueMemberBody`
}

function outOfCreditsView(): BannerView | null {
  if (isTopUpDeniedPastDue(topUpDenial.value)) {
    return {
      title: t(`${bs}.outOfCredits.title`),
      body: t(pastDueBodyKey()),
      action: canManageBilling.value ? 'updatePayment' : null,
      dismissible: true
    }
  }
  if (!permissions.value.canManageSubscription) {
    return {
      title: t(`${bs}.outOfCredits.title`),
      body: datedBody(
        `${bs}.outOfCredits.memberBody`,
        `${bs}.outOfCredits.memberBodyNoDate`
      ),
      action: null,
      dismissible: true
    }
  }
  if (!canTopUp.value) return null
  const bodyKey =
    audience.value === 'personal'
      ? `${bs}.outOfCredits.personalBody`
      : `${bs}.outOfCredits.body`
  const noDateKey =
    audience.value === 'personal'
      ? `${bs}.outOfCredits.personalBodyNoDate`
      : `${bs}.outOfCredits.bodyNoDate`
  return {
    title: t(`${bs}.outOfCredits.title`),
    body: datedBody(bodyKey, noDateKey),
    action: 'addCredits',
    dismissible: true
  }
}

function creditsLeft(): string {
  const cents = availableCents.value
  if (cents == null) return ''
  return formatCreditsFromCents({
    cents,
    locale: locale.value,
    numberOptions: { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  })
}

function lowCreditsView(): BannerView {
  return {
    title: t(`${bs}.lowCredits.title`),
    body: t(`${bs}.lowCredits.localBody`, { credits: creditsLeft() }),
    action: canTopUp.value ? 'addCredits' : null,
    dismissible: true
  }
}

const banner = computed<BannerView | null>(() => {
  if (kind.value === 'outOfCredits') return outOfCreditsView()
  if (kind.value === 'lowCredits') return lowCreditsView()
  return null
})

function dismiss() {
  const visible = kind.value
  if (visible === 'outOfCredits') {
    outOfCreditsDismissed.value = true
    if (balance.value?.lowBalance === true) lowCreditsDismissed.value = true
  } else if (visible === 'lowCredits') {
    lowCreditsDismissed.value = true
  }
}

function handleAddCredits() {
  void showTopUpCreditsDialog()
}
</script>
