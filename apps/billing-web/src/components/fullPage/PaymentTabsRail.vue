<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'

import type { PaymentTab, RailView } from '@/checkout/checkoutPage'
import PaymentFormError from '@/components/fullPage/PaymentFormError.vue'
import PaymentMethodTabs from '@/components/fullPage/PaymentMethodTabs.vue'
import SavedMethodPanel from '@/components/fullPage/SavedMethodPanel.vue'

/** The tab row and whatever the Saved tab, or a failed Add new tab, shows under it. */
const { rail, methods } = defineProps<{
  rail: Extract<RailView, { kind: 'tabs' }>
  methods: readonly SavedPaymentMethod[]
}>()

const emit = defineEmits<{
  selectTab: [tab: PaymentTab]
  paySaved: [savedMethodId: string]
  retrySaved: []
  retryElement: []
}>()

const { t } = useI18n()
</script>

<template>
  <h3 class="m-0 text-base font-semibold text-base-foreground">
    {{ t('checkout.paymentMethod') }}
  </h3>
  <PaymentMethodTabs :selected="rail.tab" @select="emit('selectTab', $event)" />
  <SavedMethodPanel
    v-if="rail.tab === 'saved'"
    :saved="rail.saved"
    :methods
    @pay="emit('paySaved', $event)"
    @retry="emit('retrySaved')"
    @add-new="emit('selectTab', 'new')"
  >
    <template #pay>
      <slot name="pay" />
    </template>
  </SavedMethodPanel>
  <PaymentFormError
    v-else-if="rail.element === 'failed'"
    rail="element"
    @retry="emit('retryElement')"
  />
</template>
