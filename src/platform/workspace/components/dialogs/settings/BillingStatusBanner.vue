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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingBanner } from '@/platform/workspace/composables/useBillingBanner'
import { useResubscribe } from '@/platform/workspace/composables/useResubscribe'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

type BannerAction = 'addCredits' | 'reactivate' | 'updatePayment'

const { t, d } = useI18n()
const { renewalDate, subscription, manageSubscription } = useBillingContext()
const { permissions } = useWorkspaceUI()
const { kind, dismiss } = useBillingBanner()
const { isResubscribing, handleResubscribe } = useResubscribe()
const dialogService = useDialogService()

const canManage = computed(() => permissions.value.canManageSubscription)
const canManageLifecycle = computed(
  () => permissions.value.canManageSubscriptionLifecycle
)
const canTopUp = computed(() => permissions.value.canTopUp)

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
    case 'paused':
      return {
        muted: false,
        title: t(`${bs}.paused.title`),
        body: canManage.value
          ? t(`${bs}.paused.body`)
          : t(`${bs}.paused.memberBody`),
        action: canManage.value ? 'updatePayment' : null,
        dismissible: false
      }
    case 'paymentFailed':
      return {
        muted: false,
        title: t(`${bs}.warning.title`),
        body: cycleResetDate.value
          ? t(`${bs}.warning.body`, { date: cycleResetDate.value })
          : t(`${bs}.warning.bodyNoDate`),
        action: 'updatePayment',
        dismissible: false
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
  void manageSubscription()
}
</script>
