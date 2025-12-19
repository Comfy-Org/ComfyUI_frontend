<template>
  <div class="flex w-112 flex-col gap-8 p-8">
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
      variant="primary"
      :class="['w-full', { 'opacity-30': !selectedCredits || loading }]"
      @click="handleBuy"
    >
      {{ $t('credits.topUp.buy') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { creditsToUsd } from '@/base/credits/comfyCredits'
import UserCredit from '@/components/common/UserCredit.vue'
import Button from '@/components/ui/button/Button.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useTelemetry } from '@/platform/telemetry'

import CreditTopUpOption from './credit/CreditTopUpOption.vue'

interface CreditOption {
  credits: number
  description: string
}

const { isInsufficientCredits = false } = defineProps<{
  isInsufficientCredits?: boolean
}>()

const { formattedRenewalDate } = useSubscription()

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
</script>
