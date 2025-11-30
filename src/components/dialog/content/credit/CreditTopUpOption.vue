<template>
  <div class="flex items-center gap-2">
    <Tag
      severity="secondary"
      icon="pi pi-wallet"
      rounded
      class="p-1 text-amber-400"
    />
    <div v-if="editable" class="flex items-center gap-2">
      <InputNumber
        v-model="customAmount"
        :min="1"
        :max="1000"
        :step="1"
        show-buttons
        :allow-empty="false"
        :highlight-on-focus="true"
        prefix="$"
        pt:pc-input-text:root="w-28"
        @blur="
          (e: InputNumberBlurEvent) =>
            (customAmount = clampUsd(Number(e.value)))
        "
        @input="
          (e: InputNumberInputEvent) =>
            (customAmount = clampUsd(Number(e.value)))
        "
      />
      <span class="text-xs text-muted">{{ formattedCredits }}</span>
    </div>
    <div v-else class="flex flex-col leading-tight">
      <span class="text-xl font-semibold">{{ formattedCredits }}</span>
      <span class="text-xs text-muted">{{ formattedUsd }}</span>
    </div>
  </div>
  <ProgressSpinner v-if="loading" class="h-8 w-8" />
  <Button
    v-else
    :severity="preselected ? 'primary' : 'secondary'"
    :outlined="!preselected"
    :label="$t('credits.topUp.buyNow')"
    @click="handleBuyNow"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import type {
  InputNumberBlurEvent,
  InputNumberInputEvent
} from 'primevue/inputnumber'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromUsd, formatUsd } from '@/base/credits/comfyCredits'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useTelemetry } from '@/platform/telemetry'

const authActions = useFirebaseAuthActions()
const telemetry = useTelemetry()

const {
  amount,
  preselected,
  editable = false
} = defineProps<{
  amount: number
  preselected: boolean
  editable?: boolean
}>()

const customAmount = ref(amount)
const didClickBuyNow = ref(false)
const loading = ref(false)
const { t, locale } = useI18n()

const clampUsd = (value: number) => {
  const safe = Number.isNaN(value) ? 0 : value
  return Math.min(1000, Math.max(1, safe))
}

const displayUsdAmount = computed(() =>
  editable ? clampUsd(Number(customAmount.value)) : clampUsd(amount)
)

const formattedCredits = computed(
  () =>
    `${formatCreditsFromUsd({
      usd: displayUsdAmount.value,
      locale: locale.value
    })} ${t('credits.credits')}`
)

const formattedUsd = computed(
  () => `$${formatUsd({ value: displayUsdAmount.value, locale: locale.value })}`
)

const handleBuyNow = async () => {
  const creditAmount = displayUsdAmount.value
  telemetry?.trackApiCreditTopupButtonPurchaseClicked(creditAmount)

  loading.value = true
  await authActions.purchaseCredits(creditAmount)
  loading.value = false
  didClickBuyNow.value = true
}

onBeforeUnmount(() => {
  if (didClickBuyNow.value) {
    // If clicked buy now, then returned back to the dialog and closed, fetch the balance
    void authActions.fetchBalance()
  }
})
</script>
