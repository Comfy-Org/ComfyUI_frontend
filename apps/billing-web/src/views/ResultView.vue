<script setup lang="ts">
/**
 * Where a hosted payment step sends the customer back. Nothing about the
 * payment travels in the URL: the lifecycle recovers whatever this scope is
 * still waiting on — the server's pending operation first, then the tab's own
 * pointer — and the projection over it is what the page shows. The trip back
 * to the product carries the coarse outcome and the operation id.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  CheckoutSteps,
  useBillingClient,
  useCheckout
} from '@comfyorg/account-ui/billing'
import type { BillingOutcome } from '@comfyorg/billing-contract'

import HostedSurface from '@/components/HostedSurface.vue'
import { STRIPE_PUBLISHABLE_KEY } from '@/config/env'
import { createStripeChallengePort } from '@/session/stripeChallengePort'

const { t } = useI18n()
const { lifecycle } = useBillingClient<'lifecycle'>(undefined)

const checkout = useCheckout({
  openUrl: (url) => window.location.assign(url),
  navigationMode: 'redirect',
  challengePort:
    STRIPE_PUBLISHABLE_KEY === undefined
      ? undefined
      : createStripeChallengePort(STRIPE_PUBLISHABLE_KEY)
})

const recovering = ref(true)

onMounted(async () => {
  await lifecycle.recover()
  recovering.value = false
})

const outcome = computed<BillingOutcome>(() => {
  switch (checkout.projection.value.step) {
    case 'success':
      return 'success'
    case 'canceled':
      return 'cancelled'
    default:
      return 'pending'
  }
})

const returnResult = computed(() => ({
  result: outcome.value,
  reference: checkout.projection.value.operationId
}))
</script>

<template>
  <HostedSurface :return-result="returnResult">
    <p v-if="recovering" class="m-0 text-sm text-muted-foreground">
      {{ t('hosted.result.recovering') }}
    </p>
    <p
      v-else-if="!checkout.operation.value"
      class="m-0 text-sm text-muted-foreground"
    >
      {{ t('hosted.result.none') }}
    </p>
    <CheckoutSteps
      v-else
      :projection="checkout.projection.value"
      root-class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-secondary-background p-6"
      header-class="m-0 text-base font-semibold text-base-foreground"
      body-class="m-0 text-sm text-muted-foreground"
      reason-class="m-0 text-sm text-destructive-background"
      safety-class="m-0 text-sm text-muted-foreground"
      actions-class="mt-2 flex gap-2"
      action-class="h-11 cursor-pointer rounded-lg bg-base-foreground px-5 font-semibold text-base-background"
      @retry="checkout.retry()"
      @cancel="checkout.cancel()"
      @continue-verification="checkout.continueVerification()"
    />
  </HostedSurface>
</template>
