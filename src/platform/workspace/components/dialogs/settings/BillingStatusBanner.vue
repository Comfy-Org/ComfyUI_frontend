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
          v-else-if="banner.action === 'updatePayment'"
          variant="inverted"
          size="lg"
          @click="handleUpdatePayment"
        >
          {{ $t('workspacePanel.billingStatus.updatePayment') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingBanner } from '@/platform/workspace/composables/useBillingBanner'
import { useResubscribe } from '@/platform/workspace/composables/useResubscribe'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

type BannerAction = 'addCredits' | 'reactivate' | 'updatePayment'

const { t, d } = useI18n()
const { renewalDate, subscription, manageSubscription } = useBillingContext()
const { toastErrorHandler } = useErrorHandling()
const { flags } = useFeatureFlags()
const { permissions } = useWorkspaceUI()
const { kind, dismiss } = useBillingBanner()
const { isResubscribing, handleResubscribe } = useResubscribe()
let recoveryPortalController: AbortController | null = null
const dialogService = useDialogService()

const canManage = computed(() => permissions.value.canManageSubscription)
const canManageLifecycle = computed(
  () => permissions.value.canManageSubscriptionLifecycle
)
const canTopUp = computed(() => permissions.value.canTopUp)

watch(
  () =>
    flags.v1PaymentRecovery &&
    canManage.value &&
    (kind.value === 'paused' || kind.value === 'paymentFailed'),
  (canUseRecoveryPortal) => {
    if (!canUseRecoveryPortal) recoveryPortalController?.abort()
  }
)

onUnmounted(() => recoveryPortalController?.abort())

const cycleResetDate = computed(() => {
  const raw = renewalDate.value
  return raw ? d(new Date(raw), { month: 'short', day: 'numeric' }) : ''
})
const planEndDate = computed(() => {
  const raw = subscription.value?.endDate
  return raw
    ? d(new Date(raw), { year: 'numeric', month: 'long', day: 'numeric' })
    : ''
})

interface BannerView {
  muted: boolean
  title: string
  body: string
  action: BannerAction | null
  dismissible: boolean
}

const banner = computed<BannerView | null>(() => {
  const bs = 'workspacePanel.billingStatus'
  switch (kind.value) {
    case 'paused': {
      const pausedKey = flags.v1PaymentRecovery
        ? `${bs}.recoveryPaused`
        : `${bs}.paused`
      return {
        muted: false,
        title: t(`${pausedKey}.title`),
        body: canManage.value
          ? t(`${pausedKey}.body`)
          : t(`${pausedKey}.memberBody`),
        action: canManage.value ? 'updatePayment' : null,
        dismissible: false
      }
    }
    case 'paymentFailed': {
      if (flags.v1PaymentRecovery && !canManage.value) return null

      const warningKey = flags.v1PaymentRecovery
        ? `${bs}.recoveryWarning`
        : `${bs}.warning`
      return {
        muted: false,
        title: t(`${warningKey}.title`),
        body: flags.v1PaymentRecovery
          ? t(`${warningKey}.bodyNoDate`)
          : cycleResetDate.value
            ? t(`${warningKey}.body`, { date: cycleResetDate.value })
            : t(`${warningKey}.bodyNoDate`),
        action: 'updatePayment',
        dismissible: false
      }
    }
    case 'outOfCredits':
      return {
        muted: false,
        title: t(`${bs}.outOfCredits.title`),
        body: canTopUp.value
          ? cycleResetDate.value
            ? t(`${bs}.outOfCredits.body`, { date: cycleResetDate.value })
            : t(`${bs}.outOfCredits.bodyNoDate`)
          : t(`${bs}.outOfCredits.memberBody`),
        action: canTopUp.value ? 'addCredits' : null,
        dismissible: true
      }
    case 'ending':
      return {
        muted: true,
        title: t(`${bs}.ending.title`, { date: planEndDate.value }),
        body: t(`${bs}.ending.body`),
        action: canManageLifecycle.value ? 'reactivate' : null,
        dismissible: false
      }
    default:
      return null
  }
})

function handleAddCredits() {
  void dialogService.showTopUpCreditsDialog()
}
function handleUpdatePayment() {
  if (!flags.v1PaymentRecovery) {
    void manageSubscription()
    return
  }
  if (!canManage.value) return

  recoveryPortalController?.abort()
  const controller = new AbortController()
  recoveryPortalController = controller
  void manageSubscription(controller.signal)
    .catch((error) => {
      if (!controller.signal.aborted) toastErrorHandler(error)
    })
    .finally(() => {
      if (recoveryPortalController === controller) {
        recoveryPortalController = null
      }
    })
}
</script>
