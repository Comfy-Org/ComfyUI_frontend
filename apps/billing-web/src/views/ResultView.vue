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
import { useRoute, useRouter } from 'vue-router'

import {
  CheckoutSteps,
  useBillingClient,
  useCheckout
} from '@comfyorg/account-ui/billing'
import type { BillingOutcome } from '@comfyorg/billing-contract'
import { billingIntentPath } from '@comfyorg/billing-contract'

import HostedSurface from '@/components/HostedSurface.vue'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { billingWebStripeKey } from '@/config/stripeKey'
import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'

const { t } = useI18n()
const { coded } = useHostedCopy()
const route = useRoute()
const router = useRouter()
const { lifecycle } = useBillingClient<'lifecycle'>(undefined)

const checkout = useCheckout({
  openUrl: (url) => window.location.assign(url),
  navigationMode: 'redirect',
  // Deferred: reads the key at challenge time, not this setup's snapshot.
  challengePort: createDeferredStripeChallengePort(billingWebStripeKey)
})

const recovering = ref(true)
const recoveryFailure = ref<string | undefined>()

onMounted(async () => {
  // `recover` reports a refusal rather than throwing, and this page is where a
  // customer lands back from the provider. Swallowing that result would tell
  // someone who may well have paid that no payment exists.
  const recovered = await lifecycle.recover()
  if (recovered.status === 'error') recoveryFailure.value = recovered.code
  recovering.value = false
})

/**
 * A recovered operation carries no `subscribe` input, so the lifecycle's own
 * retry has nothing to resend. The payment form is where a new attempt starts.
 */
function retryPayment() {
  void router.push({
    path: billingIntentPath('checkout'),
    query: route.query
  })
}

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
      v-else-if="recoveryFailure"
      class="m-0 text-sm text-destructive-background"
    >
      {{ coded('failure', recoveryFailure) }}
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
      @retry="retryPayment"
      @cancel="checkout.cancel()"
      @continue-verification="checkout.continueVerification()"
    />
  </HostedSurface>
</template>
