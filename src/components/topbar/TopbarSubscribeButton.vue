<template>
  <Button
    v-if="showUpgradeCta"
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
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { isCloud } from '@/platform/distribution/types'

const { isFreeTier, canRunWorkflows } = useBillingContext()
const { isBuilderMode } = useAppMode()

// Hidden only when the run bar is there to carry the upgrade instead: it
// turns into "Upgrade to Run" whenever the user cannot run, and two gold
// CTAs at once is what DES-534 set out to remove. Builder and arrange mode
// omit #topmenu entirely (GraphCanvas.vue), so there is nothing to defer to
// and this stays the only entry point — on the Legacy tab layout it is also
// the only one, since the avatar lives in that same omitted menu.
const showUpgradeCta = computed(
  () =>
    isCloud &&
    isFreeTier.value &&
    (canRunWorkflows.value || isBuilderMode.value)
)
const subscriptionDialog = useSubscriptionDialog()

function handleClick() {
  subscriptionDialog.showPricingTable({ reason: 'subscribe_now_button' })
}
</script>
