<template>
  <div
    v-if="embeddedCheckoutEnabled && reconciliationOperationId"
    class="rounded-lg border border-interface-stroke bg-secondary-background p-4"
  >
    <p class="m-0 font-semibold text-base-foreground">
      {{ copy.reconciliationTitle }}
    </p>
    <p class="m-0 mt-1 text-sm text-muted-foreground">
      {{ copy.reconciliationDetail }}
      <span class="font-mono">{{ reconciliationOperationId }}</span>
    </p>
  </div>

  <div
    v-if="embeddedCheckoutEnabled && authenticationState === 'failed_retryable'"
    role="alert"
    class="rounded-lg border border-interface-stroke bg-secondary-background p-4 text-sm text-base-foreground"
  >
    {{ authenticationError || copy.authenticationFailedDetail }}
  </div>
</template>

<script setup lang="ts">
/** What an earlier payment attempt left for the customer to read. */
import type { BillingAuthenticationState } from '@comfyorg/account-core/billing'

import type { CheckoutCopy } from './checkoutCopy'

const {
  embeddedCheckoutEnabled,
  reconciliationOperationId,
  authenticationState,
  authenticationError,
  copy
} = defineProps<{
  embeddedCheckoutEnabled: boolean
  reconciliationOperationId: string | null
  authenticationState: BillingAuthenticationState | null
  authenticationError: string | null
  copy: Pick<
    CheckoutCopy,
    | 'reconciliationTitle'
    | 'reconciliationDetail'
    | 'authenticationFailedDetail'
  >
}>()
</script>
