<template>
  <!-- New Credits Design (default) -->
  <div v-if="useNewDesign" class="flex w-112 flex-col gap-8 p-8">
    <!-- Header -->
    <div class="flex flex-col gap-4">
      <h1 class="text-2xl font-semibold text-base-foreground m-0">
        {{
          isInsufficientCredits
            ? $t('credits.topUp.addMoreCreditsToRun')
            : $t('credits.topUp.addMoreCredits')
        }}
      </h1>
      <div v-if="isInsufficientCredits" class="flex flex-col gap-2">
        <p class="text-sm text-muted-foreground m-0 w-96">
          {{ $t('credits.topUp.insufficientWorkflowMessage') }}
        </p>
      </div>
      <div v-else class="flex flex-col gap-2">
        <p class="text-sm text-muted-foreground m-0">
          {{ $t('credits.topUp.creditsDescription') }}
        </p>
      </div>
    </div>

    <!-- Current Balance Section -->
    <div class="flex flex-col gap-4">
      <div class="flex items-baseline gap-2">
        <UserCredit text-class="text-3xl font-bold" show-credits-only />
        <span class="text-sm text-muted-foreground">{{
          $t('credits.creditsAvailable')
        }}</span>
      </div>
      <div v-if="formattedRenewalDate" class="text-sm text-muted-foreground">
        {{ $t('credits.refreshes', { date: formattedRenewalDate }) }}
      </div>
    </div>

    <!-- Credit Options Section -->
    <div class="flex flex-col gap-4">
      <span class="text-sm text-muted-foreground">
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
      <div class="text-xs text-muted-foreground w-96">
        {{ $t('credits.topUp.templateNote') }}
      </div>
    </div>

    <!-- Buy Button -->
    <Button
      :disabled="!selectedCredits || loading"
      :loading="loading"
      severity="primary"
      :label="$t('credits.topUp.buy')"
      :class="['w-full', { 'opacity-30': !selectedCredits || loading }]"
      :pt="{ label: { class: 'text-primary-foreground' } }"
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

import { creditsToUsd } from '@/base/credits/comfyCredits'
import UserCredit from '@/components/common/UserCredit.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useTelemetry } from '@/platform/telemetry'

import CreditTopUpOption from './credit/CreditTopUpOption.vue'
import LegacyCreditTopUpOption from './credit/LegacyCreditTopUpOption.vue'

interface CreditOption {
  credits: number
  description: string
}

const {
  isInsufficientCredits = false,
  amountOptions = [5, 10, 20, 50],
  preselectedAmountOption = 10
} = defineProps<{
  isInsufficientCredits?: boolean
  amountOptions?: number[]
  preselectedAmountOption?: number
}>()

const { flags } = useFeatureFlags()
const { formattedRenewalDate } = useSubscription()
// Use feature flag to determine design - defaults to true (new design)
const useNewDesign = computed(() => flags.subscriptionTiersEnabled)

const { t } = useI18n()
const authActions = useFirebaseAuthActions()
const telemetry = useTelemetry()
const toast = useToast()

const selectedCredits = ref<number | null>(null)
const loading = ref(false)

const creditOptions: CreditOption[] = [
  {
    credits: 1055, // $5.00
    description: t('credits.topUp.videosEstimate', { count: 41 })
  },
  {
    credits: 2110, // $10.00
    description: t('credits.topUp.videosEstimate', { count: 82 })
  },
  {
    credits: 4220, // $20.00
    description: t('credits.topUp.videosEstimate', { count: 184 })
  },
  {
    credits: 10550, // $50.00
    description: t('credits.topUp.videosEstimate', { count: 412 })
  }
]

const handleBuy = async () => {
  if (!selectedCredits.value) return

  loading.value = true
  try {
    const usdAmount = creditsToUsd(selectedCredits.value)
    telemetry?.trackApiCreditTopupButtonPurchaseClicked(usdAmount)
    await authActions.purchaseCredits(usdAmount)
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
