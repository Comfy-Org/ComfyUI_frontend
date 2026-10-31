<template>
  <div class="px-8">
    <h3 class="m-0 text-sm font-normal text-muted-foreground">
      {{ $t('credits.topUp.selectAmount') }}
    </h3>
    <div class="flex gap-2 pt-3">
      <Button
        v-for="amount in TOPUP_AMOUNT_PRESETS_USD"
        :key="amount"
        :autofocus="amount === 50"
        variant="secondary"
        size="lg"
        :aria-pressed="selectedPreset === amount"
        :class="
          cn(
            'h-10 w-full text-base focus-visible:ring-ring',
            selectedPreset === amount && 'bg-muted'
          )
        "
        @click="emit('preset', amount)"
      >
        ${{ amount }}
      </Button>
    </div>
    <p
      v-if="planCreditCopy"
      class="m-0 pt-3 text-sm text-muted-foreground"
      data-testid="top-up-plan-credit-line"
    >
      {{ planCreditCopy }}
    </p>
  </div>
  <div class="flex gap-2 px-8 pt-8">
    <div
      class="flex min-w-0 flex-1 flex-col gap-3"
      data-testid="top-up-pay-amount"
    >
      <div class="text-sm text-muted-foreground">
        {{ $t('credits.topUp.youPay') }}
      </div>
      <FormNumberField
        class="w-full"
        :aria-label="$t('credits.topUp.youPay')"
        input-class="text-lg font-medium"
        :model-value="payAmount"
        :min="0"
        :max="maxAmount"
        :step="getStepAmount(payAmount)"
        :format-options="{ maximumFractionDigits: 0 }"
        @update:model-value="emit('payAmount', $event)"
      >
        <template #prefix>
          <span class="shrink-0 text-base font-semibold">$</span>
        </template>
      </FormNumberField>
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <div class="text-sm text-muted-foreground">
        {{ $t('credits.topUp.youGet') }}
      </div>
      <FormNumberField
        :model-value="credits"
        class="w-full"
        :aria-label="$t('credits.topUp.youGet')"
        input-class="text-lg font-medium"
        :min="0"
        :max="usdToCredits(maxAmount)"
        :step="usdToCredits(getStepAmount(creditsToUsd(credits)))"
        :format-options="{ maximumFractionDigits: 0 }"
        @update:model-value="emit('credits', $event)"
      >
        <template #prefix>
          <i class="icon-[lucide--coins] text-credit" />
        </template>
      </FormNumberField>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TOPUP_AMOUNT_PRESETS_USD } from '@comfyorg/account-core/billing'
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { creditsToUsd, usdToCredits } from '@/base/credits/comfyCredits'
import FormNumberField from '@/components/common/FormNumberField.vue'

const { payAmount, credits, selectedPreset, maxAmount, planCreditCopy } =
  defineProps<{
    payAmount: number
    credits: number
    selectedPreset: number | null
    maxAmount: number
    planCreditCopy: string | null
  }>()

const emit = defineEmits<{
  preset: [amount: number]
  payAmount: [amount: number]
  credits: [amount: number]
}>()

function getStepAmount(currentAmount: number): number {
  if (currentAmount < 100) return 5
  if (currentAmount < 1000) return 50
  return 100
}
</script>
