<template>
  <div class="flex w-96 flex-col gap-10 p-2">
    <div v-if="isInsufficientCredits" class="flex flex-col gap-4">
      <h1 class="my-0 text-2xl leading-normal font-medium">
        {{ $t('credits.topUp.insufficientTitle') }}
      </h1>
      <p class="my-0 text-base">
        {{ $t('credits.topUp.insufficientMessage') }}
      </p>
    </div>

    <!-- Balance Section -->
    <div class="flex items-center justify-between">
      <div class="flex w-full flex-col gap-2">
        <div class="text-base text-muted">
          {{ $t('credits.yourCreditBalance') }}
        </div>
        <div class="flex w-full items-center justify-between">
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
      <span class="text-sm text-muted"
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
