<template>
  <div class="flex flex-col w-96 p-2 gap-10">
    <div v-if="isInsufficientCredits" class="flex flex-col gap-4">
      <h1 class="text-2xl font-medium leading-normal my-0">
        {{ $t('credits.topUp.insufficientTitle') }}
      </h1>
      <p class="text-base my-0">
        {{ $t('credits.topUp.insufficientMessage') }}
      </p>
    </div>

    <!-- Balance Section -->
    <div class="flex justify-between items-center">
      <div class="flex flex-col gap-2 w-full">
        <div class="text-muted text-base">
          {{ $t('credits.yourCreditBalance') }}
        </div>
        <div class="flex items-center justify-between w-full">
          <UserCredit text-class="text-2xl" />
          <Button
            outlined
            severity="secondary"
            :label="$t('credits.topUp.seeDetails')"
            icon="pi pi-arrow-up-right"
            @click="handleSeeDetails"
          />
        </div>
      </div>
    </div>

    <!-- Amount Input Section -->
    <div class="flex flex-col gap-2">
      <span class="text-muted text-sm"
        >{{ $t('credits.topUp.quickPurchase') }}:</span
      >
      <div class="grid grid-cols-[2fr_1fr] gap-2">
        <template v-for="amount in amountOptions" :key="amount">
          <div class="flex items-center gap-2">
            <Tag
              severity="secondary"
              icon="pi pi-dollar"
              rounded
              class="text-amber-400 p-1"
            />
            <span class="text-xl">{{ amount }}</span>
          </div>
          <Button
            :severity="
              preselectedAmountOption === amount ? 'primary' : 'secondary'
            "
            :outlined="preselectedAmountOption !== amount"
            :label="$t('credits.topUp.buyNow')"
            @click="handleBuyNow(amount)"
          />
        </template>

        <div class="flex items-center gap-2">
          <Tag
            severity="secondary"
            icon="pi pi-dollar"
            rounded
            class="text-amber-400 p-1"
          />
          <InputNumber
            v-model="customAmount"
            :min="1"
            :max="1000"
            :step="1"
            show-buttons
            :allow-empty="false"
            :highlight-on-focus="true"
            pt:pc-input-text:root="w-24"
            @blur="
              (e: InputNumberBlurEvent) => (customAmount = Number(e.value))
            "
            @input="
              (e: InputNumberInputEvent) => (customAmount = Number(e.value))
            "
          />
        </div>
        <ProgressSpinner v-if="loading" class="w-8 h-8" />
        <Button
          v-else
          :label="$t('credits.topUp.buyNow')"
          severity="secondary"
          outlined
          @click="handleBuyNow(customAmount)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber, {
  type InputNumberBlurEvent,
  type InputNumberInputEvent
} from 'primevue/inputnumber'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import { computed, onBeforeUnmount, ref } from 'vue'

import UserCredit from '@/components/common/UserCredit.vue'
import { useFirebaseAuthService } from '@/services/firebaseAuthService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const {
  isInsufficientCredits = false,
  amountOptions = [5, 10, 20, 50],
  preselectedAmountOption = 10
} = defineProps<{
  isInsufficientCredits?: boolean
  amountOptions?: number[]
  preselectedAmountOption?: number
}>()

const authStore = useFirebaseAuthStore()
const authService = useFirebaseAuthService()
const customAmount = ref<number>(100)
const didClickBuyNow = ref(false)
const loading = computed(() => authStore.loading)

const handleSeeDetails = async () => {
  await authService.accessBillingPortal()
}

const handleBuyNow = async (amount: number) => {
  await authService.purchaseCredits(amount)
  didClickBuyNow.value = true
}

onBeforeUnmount(() => {
  if (didClickBuyNow.value) {
    // If clicked buy now, then returned back to the dialog and closed, fetch the balance
    void authService.fetchBalance()
  }
})
</script>
