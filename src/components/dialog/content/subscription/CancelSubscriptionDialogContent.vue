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
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
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
    <div class="flex items-center justify-end gap-4 p-4">
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
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { getSubscriptionCancellationMetadata } from '@/platform/cloud/subscription/utils/subscriptionCancellationTelemetry'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogStore } from '@/stores/dialogStore'
import { parseIsoDateSafe } from '@/utils/dateTimeUtil'
import { getErrorMessage } from '@/utils/errorUtil'

const { cancelAt, flowAlreadyOpened = false } = defineProps<{
  cancelAt?: string
  flowAlreadyOpened?: boolean
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
})

onUnmounted(() => {
  if (didCancelSucceed.value || isLoading.value) return
  telemetry?.trackSubscriptionCancellation('abandoned', cancellationMetadata())
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
  t('subscription.cancelDialog.description', { date: formattedEndDate.value })
)

function onClose() {
  if (isLoading.value) return
  dialogStore.closeDialog({ key: 'cancel-subscription' })
}

async function onConfirmCancel() {
  if (
    shouldUseWorkspaceBilling.value &&
    !(isCloud
      ? canCancel.value
      : permissions.value.canManageSubscriptionLifecycle)
  ) {
    return
  }

  telemetry?.trackSubscriptionCancellation('confirmed', cancellationMetadata())
  isLoading.value = true
  try {
    await cancelSubscription()
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    if (!shouldUseWorkspaceBilling.value) {
      telemetry?.trackSubscriptionCancellation('failed', cancellationMetadata())
    }
    toast.add({
      severity: 'error',
      summary: t('subscription.cancelDialog.failed'),
      detail: errorMessage ?? t('g.unknownError')
    })
    isLoading.value = false
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
