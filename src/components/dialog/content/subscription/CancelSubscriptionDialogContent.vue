<template>
  <div
    class="flex w-full max-w-[400px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('subscription.cancelDialog.title') }}
      </h2>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
        :aria-label="$t('g.close')"
        :disabled="isLoading"
        @click="onClose"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="flex flex-col gap-4 p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ description }}
      </p>
    </div>

    <!-- Footer -->
    <div
      v-if="isAwaitingStripe"
      class="flex items-center justify-end gap-4 p-4"
    >
      <Button variant="muted-textonly" @click="onClose">
        {{ $t('g.close') }}
      </Button>
    </div>
    <div v-else class="flex items-center justify-end gap-4 p-4">
      <Button variant="muted-textonly" :disabled="isLoading" @click="onClose">
        {{ $t('subscription.cancelDialog.keepSubscription') }}
      </Button>
      <Button
        variant="destructive"
        size="lg"
        :loading="isLoading"
        @click="onConfirmCancel"
      >
        {{ $t('subscription.cancelDialog.confirmCancel') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defaultWindow, useEventListener } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
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

const { t } = useI18n()
const dialogStore = useDialogStore()
const toast = useToast()
const { cancelSubscription, fetchStatus, subscription, tier } =
  useBillingContext()
const { shouldUseWorkspaceBilling } = useBillingRouting()
const { canCancel } = useBillingCapabilities()
const { permissions } = useWorkspaceUI()
const telemetry = useTelemetry()

const isLoading = ref(false)
const didCancelSucceed = ref(false)
const isAwaitingStripe = ref(false)
let wasCancelledAtConfirm = false
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

onUnmounted(() => {
  if (didCancelSucceed.value || didScopeAbort.value || isLoading.value) return
  telemetry?.trackSubscriptionCancellation('abandoned', cancellationMetadata())
  cancelReport.abandoned()
})

const formattedEndDate = computed(() => {
  const date = parseIsoDateSafe(cancelAt ?? subscription.value?.endDate)
  if (!date) return t('subscription.cancelDialog.endOfBillingPeriod')
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
})

const description = computed(() =>
  isAwaitingStripe.value
    ? t('subscription.cancelDialog.finishOnStripe')
    : t('subscription.cancelDialog.description', {
        date: formattedEndDate.value
      })
)

function completeObservedCancel() {
  if (wasCancelledAtConfirm || didCancelSucceed.value) return
  if (!isScopeCurrent()) {
    didScopeAbort.value = true
    dialogStore.closeDialog({ key: 'cancel-subscription' })
    return
  }
  didCancelSucceed.value = true
  isAwaitingStripe.value = false
  telemetry?.trackSubscriptionCancellation('confirmed', cancellationMetadata())
  cancelReport.confirmed({ operationFollows: false })
  dialogStore.closeDialog({ key: 'cancel-subscription' })
  toast.add({
    severity: 'success',
    summary: t('subscription.cancelSuccess'),
    life: 5000
  })
}

watch(
  () => !!subscription.value?.isCancelled,
  (cancelled) => {
    if (cancelled && isAwaitingStripe.value) completeObservedCancel()
  }
)

// The shared watcher gives up after a few minutes; keep checking on return from Stripe.
useEventListener(defaultWindow, 'focus', () => {
  if (!isAwaitingStripe.value) return
  fetchStatus().catch(() => {})
})

function onClose() {
  if (isLoading.value) return
  dialogStore.closeDialog({ key: 'cancel-subscription' })
}

function abortForScopeChange() {
  didScopeAbort.value = true
  toast.add({
    severity: 'warn',
    summary: t('subscription.cancelDialog.workspaceChanged')
  })
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
  toast.add({
    severity: 'error',
    summary: t('subscription.cancelDialog.failed'),
    detail: getErrorMessage(error) ?? t('g.unknownError')
  })
  isLoading.value = false
}

async function onConfirmCancel() {
  if (!isScopeCurrent()) return abortForScopeChange()
  if (lacksWorkspaceCancelPermission()) return

  // The legacy rail only opens the Stripe portal, so it reports `confirmed`
  // once the cancellation is observed instead of on click.
  const isLegacyRail = !shouldUseWorkspaceBilling.value
  wasCancelledAtConfirm = !!subscription.value?.isCancelled
  if (!isLegacyRail) {
    telemetry?.trackSubscriptionCancellation(
      'confirmed',
      cancellationMetadata()
    )
    cancelReport.confirmed({ operationFollows: true })
  }
  isLoading.value = true
  try {
    await cancelSubscription(isScopeCurrent)
  } catch (error) {
    reportCancelFailure(error)
    return
  }

  if (isLegacyRail) {
    isAwaitingStripe.value = true
    isLoading.value = false
    // The cancel may have been observed while the portal call was pending.
    if (subscription.value?.isCancelled) completeObservedCancel()
    return
  }

  didCancelSucceed.value = true
  try {
    await fetchStatus()
  } catch {
    // Cancellation already succeeded; stale local subscription status should not report failure.
  }
  dialogStore.closeDialog({ key: 'cancel-subscription' })
  toast.add({
    severity: 'success',
    summary: t('subscription.cancelSuccess'),
    life: 5000
  })
  isLoading.value = false
}
</script>
