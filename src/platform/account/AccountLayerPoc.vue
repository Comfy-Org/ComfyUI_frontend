<template>
  <aside
    v-if="
      enabled &&
      (exchangeError ||
        credits.phase === 'error' ||
        (credits.phase !== 'idle' && credits.phase !== 'empty'))
    "
    class="fixed right-4 bottom-4 z-50 rounded-lg bg-comfy-menu-bg p-3"
    data-testid="account-layer-poc"
  >
    <AccountLayerBillingPoc host="settings" />
    <CreditsDisplay
      source="props"
      :state="
        exchangeError ? { phase: 'error', error: exchangeError } : credits
      "
    />
    <button
      v-if="exchangeError || credits.phase === 'error'"
      class="ml-3"
      data-testid="account-poc-sign-out"
      type="button"
      @click="signOut"
    >
      {{ t('auth.signOut.signOut') }}
    </button>
  </aside>
</template>

<script setup lang="ts">
import { CreditsDisplay, useCredits } from '@comfyorg/account/vue'
import { defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  accountLayerPocExchangeError as exchangeError,
  getAccountLayerPocDebug
} from '@/platform/account/accountClient'

const enabled = import.meta.env.VITE_ACCOUNT_LAYER_POC === 'true'
const AccountLayerBillingPoc = defineAsyncComponent(
  () => import('@/platform/account/AccountLayerBillingPoc.vue')
)
const credits = useCredits()
const { t } = useI18n()

function signOut() {
  return getAccountLayerPocDebug().signOut()
}
</script>
