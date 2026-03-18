<template>
  <Button
    v-if="isCloud && isFreeTier"
    class="mr-2 shrink-0 whitespace-nowrap"
    variant="gradient"
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
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { isCloud } from '@/platform/distribution/types'

const { isFreeTier } = useBillingContext()
const subscriptionDialog = useSubscriptionDialog()

function handleClick() {
  subscriptionDialog.showPricingTable()
}
</script>
