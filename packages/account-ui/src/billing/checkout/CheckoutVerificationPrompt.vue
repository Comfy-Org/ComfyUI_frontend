<template>
  <p role="status" class="m-0 text-sm text-muted-foreground">
    {{ copy.pendingVerificationDetail }}
  </p>
  <CheckoutButton
    variant="inverted"
    size="lg"
    class="w-full rounded-lg"
    @click="openVerification"
  >
    {{ copy.completeVerification }}
  </CheckoutButton>
</template>

<script setup lang="ts">
/**
 * A pending 3DS verification is the only actionable step, so it leads the
 * footer and opens the bank's page in a new tab.
 */
import CheckoutButton from './CheckoutButton.vue'
import type { CheckoutCopy } from './checkoutCopy'

const { actionUrl, copy } = defineProps<{
  actionUrl: string
  copy: Pick<CheckoutCopy, 'pendingVerificationDetail' | 'completeVerification'>
}>()

function openVerification() {
  window.open(actionUrl, '_blank', 'noopener,noreferrer')
}
</script>
