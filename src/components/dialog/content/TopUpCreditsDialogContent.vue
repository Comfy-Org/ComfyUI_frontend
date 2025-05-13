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
        <CreditTopUpOption
          v-for="amount in amountOptions"
          :key="amount"
          :amount="amount"
          :preselected="amount === preselectedAmountOption"
        />

        <CreditTopUpOption :amount="100" :preselected="false" editable />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import UserCredit from '@/components/common/UserCredit.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'

import CreditTopUpOption from './credit/CreditTopUpOption.vue'

const {
  isInsufficientCredits = false,
  amountOptions = [5, 10, 20, 50],
  preselectedAmountOption = 10
} = defineProps<{
  isInsufficientCredits?: boolean
  amountOptions?: number[]
  preselectedAmountOption?: number
}>()

const authActions = useFirebaseAuthActions()

const handleSeeDetails = async () => {
  await authActions.accessBillingPortal()
}
</script>
