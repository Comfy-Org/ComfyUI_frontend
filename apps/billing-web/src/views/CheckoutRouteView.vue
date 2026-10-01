<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CheckoutUiState } from '@/config/checkoutUi'
import { awaitCheckoutUiVariant, settleCheckoutUi } from '@/config/checkoutUi'
import { useBillingEntry } from '@/entry/billingEntry'
import CheckoutView from '@/views/CheckoutView.vue'
import EntryErrorView from '@/views/EntryErrorView.vue'
import FullPageCheckoutView from '@/views/FullPageCheckoutView.vue'

const { t } = useI18n()
const { error: unreadableLink } = useBillingEntry()
const state = shallowRef<CheckoutUiState>({ phase: 'resolving' })

void awaitCheckoutUiVariant().then((variant) => {
  state.value = settleCheckoutUi(state.value, variant)
})
</script>

<template>
  <FullPageCheckoutView
    v-if="state.phase === 'settled' && state.variant === 'full_page'"
  />
  <EntryErrorView v-else-if="state.phase === 'settled' && unreadableLink" />
  <CheckoutView v-else-if="state.phase === 'settled'" />
  <main
    v-else
    class="dark-theme fixed inset-0 overflow-auto bg-charcoal-950 px-4 py-6 font-inter sm:px-6 sm:py-10"
  >
    <section class="mx-auto flex min-h-full max-w-7xl items-center">
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('hosted.loading') }}
      </p>
    </section>
  </main>
</template>
