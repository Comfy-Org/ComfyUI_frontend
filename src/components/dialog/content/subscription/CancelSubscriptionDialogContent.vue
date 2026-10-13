<template>
  <CancellationStepLayout
    :title="
      didCancelSucceed
        ? $t('subscription.cancelFlow.cancelled.title')
        : $t('subscription.cancelFlow.confirm.title')
    "
    :subtitle="didCancelSucceed ? description : undefined"
    :close-disabled="isClosingBlocked"
    :on-close="onClose"
  >
    <p
      v-if="isAwaitingStripe"
      class="m-0 text-sm/5 text-muted-foreground"
      role="status"
    >
      {{ $t('subscription.cancelDialog.finishOnStripe') }}
    </p>
    <template v-else-if="!didCancelSucceed">
      <p class="m-0 text-sm/5 text-muted-foreground">{{ description }}</p>
      <p class="m-0 text-sm/5 text-base-foreground">
        {{
          $t('subscription.cancelFlow.confirm.loseAccess', {
            date: formattedEndDate
          })
        }}
      </p>
      <ul class="m-0 grid list-none grid-cols-2 gap-2 p-0">
        <li
          v-for="feature in lostFeatures"
          :key="feature.key"
          class="flex flex-col gap-1.5 rounded-[10px] border border-border-subtle bg-secondary-background/50 p-3"
        >
          <i
            :class="cn(feature.icon, 'size-4 text-base-foreground')"
            aria-hidden="true"
          />
          <span class="text-sm text-base-foreground">{{ feature.title }}</span>
          <span class="text-xs text-muted-foreground">
            {{ feature.description }}
          </span>
        </li>
      </ul>
    </template>

    <template #actions>
      <Button
        v-if="didCancelSucceed"
        variant="secondary"
        size="lg"
        class="w-24"
        @click="onClose"
      >
        {{ $t('subscription.cancelFlow.done') }}
      </Button>
      <Button
        v-else-if="isAwaitingStripe"
        variant="secondary"
        size="lg"
        @click="onClose"
      >
        {{ $t('g.close') }}
      </Button>
      <template v-else>
        <Button
          variant="textonly"
          size="lg"
          :disabled="isLoading"
          @click="onClose"
        >
          {{ $t('subscription.cancelFlow.keepPlan') }}
        </Button>
        <Button
          variant="destructive"
          size="lg"
          :loading="isLoading"
          @click="onConfirmCancel"
        >
          {{ $t('subscription.cancelFlow.confirm.cancelPlan') }}
        </Button>
      </template>
    </template>
  </CancellationStepLayout>
</template>

<script setup lang="ts">
import { defaultWindow, useEventListener, useThrottleFn } from '@vueuse/core'
import { useToast } from '@/components/ui/toast/toastStore'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { CancelRail } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import CancellationStepLayout from '@/platform/cloud/subscription/components/CancellationStepLayout.vue'
import { useCancellationPlan } from '@/platform/cloud/subscription/composables/useCancellationPlan'
import {
  createCancelFlowReporter,
  getSubscriptionCancellationMetadata
} from '@/platform/cloud/subscription/utils/subscriptionCancellationTelemetry'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogStore } from '@/stores/dialogStore'
import { parseIsoDateSafe } from '@/utils/dateTimeUtil'
import { getErrorMessage } from '@/utils/errorUtil'

const {
  cancelAt,
  flowAlreadyOpened = false,
  flowAlreadyConfirmed = false,
  isScopeCurrent = () => true
} = defineProps<{
  cancelAt?: string
  flowAlreadyOpened?: boolean
  flowAlreadyConfirmed?: boolean
  isScopeCurrent?: () => boolean
}>()

const { t, n } = useI18n()
const dialogStore = useDialogStore()
const toast = useToast()
const { cancelSubscription, fetchStatus, subscription, tier } =
  useBillingContext()
const { shouldUseWorkspaceBilling } = useBillingRouting()
const { canCancel } = useBillingCapabilities()
const { permissions } = useWorkspaceUI()
const { planName, creditGrant } = useCancellationPlan()
const telemetry = useTelemetry()

const isLoading = ref(false)
const didCancelSucceed = ref(false)
const isAwaitingStripe = ref(false)
// Last seen `isCancelled` (null until the status loads). A cancel only counts
// as observed when it turns true after a loaded, not-cancelled reading.
let lastCancelled: boolean | null = null
let cancelObserved = false
const didScopeAbort = ref(false)
const cancelReport = createCancelFlowReporter(
  telemetry,
  () => ({
    duration: subscription.value?.duration,
    tier: tier.value
  }),
  { confirmed: flowAlreadyConfirmed }
)

function cancellationMetadata() {
  return getSubscriptionCancellationMetadata({
    cancelAt,
    duration: subscription.value?.duration,
    endDate: subscription.value?.endDate,
    tier: tier.value
  })
}

onMounted(() => {
  if (flowAlreadyOpened) return
  telemetry?.trackSubscriptionCancellation(
    'flow_opened',
    cancellationMetadata()
  )
  cancelReport.intent()
})

function reportAbandoned() {
  telemetry?.trackSubscriptionCancellation('abandoned', cancellationMetadata())
  cancelReport.abandoned()
}

let unmounted = false
onUnmounted(() => {
  unmounted = true
  if (didCancelSucceed.value || didScopeAbort.value || isLoading.value) return
  reportAbandoned()
})

const formattedEndDate = computed(() => {
  const date = parseIsoDateSafe(
    cancelAt ?? subscription.value?.endDate ?? subscription.value?.renewalDate
  )
  if (!date) return t('subscription.cancelDialog.endOfBillingPeriod')
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
})

const description = computed(() =>
  t('subscription.cancelFlow.confirm.description', {
    plan: planName.value,
    date: formattedEndDate.value
  })
)

function creditsTitle() {
  const grant = creditGrant.value
  if (!grant)
    return t('subscription.cancelFlow.confirm.features.credits.generic')
  const named = { credits: n(grant.credits) }
  return grant.cycle === 'yearly'
    ? t('subscription.cancelFlow.confirm.features.credits.yearly', named)
    : t('subscription.cancelFlow.confirm.features.credits.monthly', named)
}

const lostFeatures = computed(() => {
  return [
    {
      key: 'gpus',
      icon: 'icon-[lucide--cpu]',
      title: t('subscription.cancelFlow.confirm.features.gpus.title'),
      description: t(
        'subscription.cancelFlow.confirm.features.gpus.description'
      )
    },
    {
      key: 'models',
      icon: 'icon-[lucide--layers]',
      title: t('subscription.cancelFlow.confirm.features.models.title'),
      description: t(
        'subscription.cancelFlow.confirm.features.models.description'
      )
    },
    {
      key: 'customNodes',
      icon: 'icon-[lucide--blocks]',
      title: t('subscription.cancelFlow.confirm.features.customNodes.title'),
      description: t(
        'subscription.cancelFlow.confirm.features.customNodes.description'
      )
    },
    {
      key: 'credits',
      icon: 'icon-[lucide--coins]',
      title: creditsTitle(),
      description: t(
        'subscription.cancelFlow.confirm.features.credits.description'
      )
    }
  ]
})

function completeObservedCancel() {
  if (!cancelObserved || didCancelSucceed.value) return
  if (!isScopeCurrent()) return abortForScopeChange()
  didCancelSucceed.value = true
  isAwaitingStripe.value = false
  telemetry?.trackSubscriptionCancellation('confirmed', cancellationMetadata())
  cancelReport.confirmed({ operationFollows: false })
}

watch(
  () => (subscription.value ? !!subscription.value.isCancelled : null),
  (cancelled) => {
    if (cancelled === null) return
    if (cancelled && lastCancelled === false) cancelObserved = true
    if (!cancelled) cancelObserved = false
    lastCancelled = cancelled
    if (cancelObserved && isAwaitingStripe.value) completeObservedCancel()
  }
)

// The shared watcher gives up after a few minutes; keep checking on return from Stripe.
const refreshOnFocus = useThrottleFn(() => {
  if (isAwaitingStripe.value) fetchStatus().catch(() => {})
}, 10_000)
useEventListener(defaultWindow, 'focus', () => void refreshOnFocus())

const isClosingBlocked = computed(
  () => isLoading.value && !didCancelSucceed.value
)

function onClose() {
  if (isClosingBlocked.value) return
  dialogStore.closeDialog({ key: 'cancel-subscription' })
}

function abortForScopeChange() {
  didScopeAbort.value = true
  toast.warning(t('subscription.cancelDialog.workspaceChanged'))
  dialogStore.closeDialog({ key: 'cancel-subscription' })
}

function lacksWorkspaceCancelPermission() {
  return (
    shouldUseWorkspaceBilling.value &&
    !(isCloud
      ? canCancel.value
      : permissions.value.canManageSubscriptionLifecycle)
  )
}

function reportCancelFailure(error: unknown) {
  if (!shouldUseWorkspaceBilling.value) {
    telemetry?.trackSubscriptionCancellation('failed', cancellationMetadata())
    cancelReport.confirmed({ operationFollows: false })
    cancelReport.failed(categorizeBillingApiError(error))
  }
  toast.error(t('subscription.cancelDialog.failed'), {
    description: getErrorMessage(error) ?? t('g.unknownError')
  })
  isLoading.value = false
}

function reportWorkspaceConfirmed() {
  telemetry?.trackSubscriptionCancellation('confirmed', cancellationMetadata())
  cancelReport.confirmed({ operationFollows: true })
}

function awaitStripeCancel() {
  // Dismissed while the portal call was pending: nothing was observed and no
  // other terminal event will fire.
  if (unmounted) return reportAbandoned()
  isAwaitingStripe.value = true
  isLoading.value = false
  // The cancel may have been observed while the portal call was pending.
  completeObservedCancel()
}

async function finishWorkspaceCancel() {
  didCancelSucceed.value = true
  try {
    await fetchStatus()
  } catch {
    // Cancellation already succeeded; stale local subscription status should not report failure.
  }
  isLoading.value = false
}

function handleCancelError(error: unknown) {
  if (!isScopeCurrent()) return abortForScopeChange()
  reportCancelFailure(error)
}

// The rail comes from the cancel call itself; current routing may have flipped since.
async function finishCancel(rail: CancelRail, confirmedBeforeCall: boolean) {
  if (!isScopeCurrent()) return abortForScopeChange()
  if (rail === 'legacy') return awaitStripeCancel()
  if (!confirmedBeforeCall) reportWorkspaceConfirmed()
  await finishWorkspaceCancel()
}

async function onConfirmCancel() {
  if (!isScopeCurrent()) return abortForScopeChange()
  if (lacksWorkspaceCancelPermission()) return

  // The legacy rail only opens the Stripe portal, so it reports `confirmed`
  // once the cancellation is observed instead of on click.
  const confirmedBeforeCall = shouldUseWorkspaceBilling.value
  if (confirmedBeforeCall) reportWorkspaceConfirmed()
  lastCancelled = subscription.value ? !!subscription.value.isCancelled : null
  cancelObserved = false
  isLoading.value = true
  let rail: CancelRail
  try {
    rail = await cancelSubscription(isScopeCurrent)
  } catch (error) {
    return handleCancelError(error)
  }
  await finishCancel(rail, confirmedBeforeCall)
}
</script>
