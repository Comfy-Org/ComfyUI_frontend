<template>
  <Button
    v-if="isCloud && isFreeTier && !subscribeToRunPromptVisible"
    class="mr-2 shrink-0 whitespace-nowrap"
    variant="subscribe"
    size="sm"
    data-testid="topbar-subscribe-button"
    @click="handleClick"
  >
    {{ $t('subscription.subscribeForMore') }}
  </Button>
</template>

<script setup lang="ts">
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
