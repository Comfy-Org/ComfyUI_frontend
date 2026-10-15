<template>
  <Button
    v-if="isCloud && isFreeTier && !subscribeToRunPromptVisible"
    class="mr-2 shrink-0 whitespace-nowrap"
    variant="subscribe"
    size="sm"
    data-testid="topbar-subscribe-button"
    :data-dd-action-name="BILLING_ACTION_NAME.subscribeTopbar"
    @click="handleClick"
  >
    {{ $t('subscription.subscribeForMore') }}
  </Button>
</template>

<script setup lang="ts">
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscribeToRunPromptPresence } from '@/platform/cloud/subscription/composables/useSubscribeCtaPresence'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { isCloud } from '@/platform/distribution/types'

const { isFreeTier } = useBillingContext()
const subscribeToRunPromptVisible = useSubscribeToRunPromptPresence()
const subscriptionDialog = useSubscriptionDialog()

function handleClick() {
  subscriptionDialog.showPricingTable({ reason: 'subscribe_now_button' })
}
</script>
