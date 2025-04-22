<template>
  <div class="flex flex-col p-6">
    <div
      class="flex items-center gap-2"
      :class="{ 'text-red-500': isInsufficientCredits }"
    >
      <i
        :class="[
          'text-2xl',
          isInsufficientCredits ? 'pi pi-exclamation-triangle' : ''
        ]"
      />
      <h2 class="text-2xl font-semibold">
        {{
          $t(
            isInsufficientCredits
              ? 'credits.topUp.insufficientTitle'
              : 'credits.topUp.title'
          )
        }}
      </h2>
    </div>

    <!-- Error Message -->
    <p v-if="isInsufficientCredits" class="text-lg text-muted mt-6">
      {{ $t('credits.topUp.insufficientMessage') }}
    </p>

    <!-- Balance Section -->
    <div class="flex justify-between items-center mt-8">
      <div class="flex flex-col gap-2">
        <div class="text-muted">{{ $t('credits.yourCreditBalance') }}</div>
        <div class="flex items-center gap-2">
          <Tag
            severity="secondary"
            icon="pi pi-dollar"
            rounded
            class="text-amber-400 p-1"
          />
          <span class="text-2xl">{{ formattedBalance }}</span>
        </div>
      </div>
      <Button
        text
        severity="secondary"
        :label="$t('credits.creditsHistory')"
        icon="pi pi-arrow-up-right"
        @click="handleSeeDetails"
      />
    </div>

    <!-- Amount Input Section -->
    <div class="flex flex-col gap-2 mt-8">
      <div>
        <span class="text-muted">{{ $t('credits.topUp.addCredits') }}</span>
        <span class="text-muted text-sm ml-1">{{
          $t('credits.topUp.maxAmount')
        }}</span>
      </div>
      <div class="flex items-center gap-2">
        <Tag
          severity="secondary"
          icon="pi pi-dollar"
          rounded
          class="text-amber-400 p-1"
        />
        <InputNumber
          v-model="amount"
          :min="1"
          :max="1000"
          :step="1"
          mode="currency"
          currency="USD"
          show-buttons
          @blur="handleBlur"
          @input="handleInput"
        />
      </div>
    </div>
    <div class="flex justify-end mt-8">
      <ProgressSpinner v-if="loading" class="w-8 h-8" />
      <Button
        v-else
        severity="primary"
        :label="$t('credits.topUp.buyNow')"
        :disabled="!amount || amount > 1000"
        :pt="{
          root: { class: 'px-8' }
        }"
        @click="handleBuyNow"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import { computed, onBeforeUnmount, ref } from 'vue'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { formatMetronomeCurrency, usdToMicros } from '@/utils/formatUtil'

defineProps<{
  isInsufficientCredits?: boolean
}>()

const authStore = useFirebaseAuthStore()
const amount = ref<number>(9.99)
const didClickBuyNow = ref(false)
const loading = computed(() => authStore.loading)

const handleBlur = (e: any) => {
  if (e.target.value) {
    amount.value = parseFloat(e.target.value)
  }
}

const handleInput = (e: any) => {
  amount.value = e.value
}

const formattedBalance = computed(() => {
  if (!authStore.balance) return '0.000'
  return formatMetronomeCurrency(authStore.balance.amount_micros, 'usd')
})

const handleSeeDetails = async () => {
  const response = await authStore.accessBillingPortal()
  if (!response?.billing_portal_url) return
  window.open(response.billing_portal_url, '_blank')
}

const handleBuyNow = async () => {
  if (!amount.value) return

  const response = await authStore.initiateCreditPurchase({
    amount_micros: usdToMicros(amount.value),
    currency: 'usd'
  })

  if (!response?.checkout_url) return

  didClickBuyNow.value = true

  // Go to Stripe checkout page
  window.open(response.checkout_url, '_blank')
}

onBeforeUnmount(() => {
  if (didClickBuyNow.value) {
    // If clicked buy now, then returned back to the dialog and closed, fetch the balance
    void authStore.fetchBalance()
  }
})
</script>
