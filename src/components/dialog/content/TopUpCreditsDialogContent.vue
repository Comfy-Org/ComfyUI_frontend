<template>
  <!-- New Credits Design (default) -->
  <div
    v-if="useNewDesign"
    class="flex w-96 flex-col gap-8 p-8 bg-node-component-surface rounded-2xl border border-border-primary"
  >
    <!-- Header -->
    <div class="flex flex-col gap-4">
      <h1 class="text-2xl font-semibold text-foreground-primary m-0">
        {{ $t('credits.topUp.addMoreCredits') }}
      </h1>
      <p class="text-sm text-foreground-secondary m-0">
        {{ $t('credits.topUp.creditsDescription') }}
      </p>
    </div>

    <!-- Current Balance Section -->
    <div class="flex flex-col gap-4">
      <div class="flex items-baseline gap-2">
        <UserCredit text-class="text-3xl font-bold" />
        <span class="text-sm text-foreground-secondary">{{
          $t('credits.creditsAvailable')
        }}</span>
      </div>
      <div v-if="refreshDate" class="text-sm text-foreground-secondary">
        {{ $t('credits.refreshes', { date: refreshDate }) }}
      </div>
    </div>

    <!-- Credit Options Section -->
    <div class="flex flex-col gap-4">
      <span class="text-sm text-foreground-secondary">
        {{ $t('credits.topUp.howManyCredits') }}
      </span>
      <div class="flex flex-col gap-2">
        <CreditTopUpOption
          v-for="option in creditOptions"
          :key="option.credits"
          :credits="option.credits"
          :description="option.description"
          :selected="selectedCredits === option.credits"
          @select="selectedCredits = option.credits"
        />
      </div>
      <div class="text-xs text-foreground-secondary">
        {{ $t('credits.topUp.templateNote') }}
      </div>
    </div>

    <!-- Buy Button -->
    <Button
      :disabled="!selectedCredits || loading"
      :loading="loading"
      severity="primary"
      :label="$t('credits.topUp.buy')"
      class="w-full"
      @click="handleBuy"
    />
  </div>

  <!-- Legacy Design -->
  <div v-else class="flex w-96 flex-col gap-10 p-2">
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
        <LegacyCreditTopUpOption
          v-for="amount in amountOptions"
          :key="amount"
          :amount="amount"
          :preselected="amount === preselectedAmountOption"
        />

        <LegacyCreditTopUpOption :amount="100" :preselected="false" editable />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  creditsToUsd,
  formatCredits,
  formatUsd
} from '@/base/credits/comfyCredits'
import UserCredit from '@/components/common/UserCredit.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@/platform/telemetry'

import CreditTopUpOption from './credit/CreditTopUpOption.vue'
import LegacyCreditTopUpOption from './credit/LegacyCreditTopUpOption.vue'

interface CreditOption {
  credits: number
  description: string
}

const {
  refreshDate,
  isInsufficientCredits = false,
  amountOptions = [5, 10, 20, 50],
  preselectedAmountOption = 10
} = defineProps<{
  refreshDate?: string
  isInsufficientCredits?: boolean
  amountOptions?: number[]
  preselectedAmountOption?: number
}>()

const { flags } = useFeatureFlags()
// Use feature flag to determine design - defaults to true (new design)
const useNewDesign = computed(() => flags.subscriptionTiersEnabled)

const { t, locale } = useI18n()
const authActions = useFirebaseAuthActions()
const telemetry = useTelemetry()
const toast = useToast()

const selectedCredits = ref<number | null>(null)
const loading = ref(false)

const creditOptions: CreditOption[] = [
  {
    credits: 1000,
    description: t('credits.topUp.videosEstimate', { count: 100 })
  },
  {
    credits: 5000,
    description: t('credits.topUp.videosEstimate', { count: 500 })
  },
  {
    credits: 10000,
    description: t('credits.topUp.videosEstimate', { count: 1000 })
  },
  {
    credits: 20000,
    description: t('credits.topUp.videosEstimate', { count: 2000 })
  }
]

const handleBuy = async () => {
  if (!selectedCredits.value) return

  loading.value = true
  try {
    const usdAmount = creditsToUsd(selectedCredits.value)
    telemetry?.trackApiCreditTopupButtonPurchaseClicked(usdAmount)
    await authActions.purchaseCredits(usdAmount)

    toast.add({
      severity: 'success',
      summary: t('credits.topUp.purchaseSuccess'),
      detail: t('credits.topUp.purchaseSuccessDetail', {
        credits: formatCredits({
          value: selectedCredits.value,
          locale: locale.value
        }),
        amount: `$${formatUsd({ value: usdAmount, locale: locale.value })}`
      }),
      life: 3000
    })
  } catch (error) {
    console.error('Purchase failed:', error)

    const errorMessage =
      error instanceof Error ? error.message : t('credits.topUp.unknownError')
    toast.add({
      severity: 'error',
      summary: t('credits.topUp.purchaseError'),
      detail: t('credits.topUp.purchaseErrorDetail', { error: errorMessage }),
      life: 5000
    })
  } finally {
    loading.value = false
  }
}

const handleSeeDetails = async () => {
  await authActions.accessBillingPortal()
}
</script>
