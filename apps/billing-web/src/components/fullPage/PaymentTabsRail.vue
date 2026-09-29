<script setup lang="ts">
import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'

import type { PaymentTab, RailView } from '@/checkout/checkoutPage'
import PaymentFormError from '@/components/fullPage/PaymentFormError.vue'
import PaymentMethodTabs from '@/components/fullPage/PaymentMethodTabs.vue'
import SavedMethodPanel from '@/components/fullPage/SavedMethodPanel.vue'

/** The tab row and whatever the Saved tab, or a failed Add new tab, shows under it. */
const {
  rail,
  methods,
  locked = false
} = defineProps<{
  rail: Extract<RailView, { kind: 'tabs' }>
  methods: readonly SavedPaymentMethod[]
  /** Money is on its way: the tabs and the saved methods are inert. */
  locked?: boolean
}>()

const emit = defineEmits<{
  selectTab: [tab: PaymentTab]
  paySaved: [savedMethodId: string]
  retrySaved: []
  retryElement: []
}>()
</script>

<template>
  <PaymentMethodTabs
    :selected="rail.tab"
    :inert="locked"
    @select="emit('selectTab', $event)"
  />
  <SavedMethodPanel
    v-if="rail.tab === 'saved'"
    :saved="rail.saved"
    :methods
    :locked
    @pay="emit('paySaved', $event)"
    @retry="emit('retrySaved')"
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
