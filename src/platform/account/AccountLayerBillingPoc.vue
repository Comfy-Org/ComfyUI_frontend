<template>
  <div
    :data-testid="`account-layer-billing-${host}-step-${state.step}`"
    :data-copy-key="copyKey"
    class="flex flex-col gap-3 rounded-lg border border-border-default p-4"
  >
    <CheckoutSteps
      :step="state.step"
      :reason="state.reasonKey"
      :no-charge-confirmed="state.noChargeConfirmed"
      data-testid="account-layer-checkout-steps"
      @retry="checkout.retry"
    />
    <div v-if="state.step === 'select'" class="flex gap-2">
      <Button data-testid="account-layer-subscribe" @click="subscribe">
        {{ t('accountLayerPoc.subscribe') }}
      </Button>
      <Button variant="secondary" @click="topUp">
        {{ t('accountLayerPoc.topUp') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckoutSteps, useCheckout, useTopUp } from '@comfyorg/account/vue'
import { billingCopyKeys } from '@comfyorg/account/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { getAccountLayerBillingCommands } from '@/platform/account/accountClient'

const { host } = defineProps<{ host: 'settings' | 'modal' }>()

const { t } = useI18n()
const commands = getAccountLayerBillingCommands()
const checkout = useCheckout(commands)
const topup = useTopUp(commands)
const state = checkout.state
const copyKey = computed(() => billingCopyKeys(state.value).body)

async function subscribe() {
  const base = `${window.location.origin}/payment`
  await checkout.submit({
    plan_slug: 'pro-monthly',
    return_url: `${base}/success`,
    cancel_url: `${base}/failed`
  })
}

async function topUp() {
  await topup.submit({
    amount_cents: 500,
    idempotency_key: crypto.randomUUID()
  })
}
</script>
