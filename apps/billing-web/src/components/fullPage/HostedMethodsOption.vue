<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type { InlineOutcome } from '@/checkout/checkoutPage'
import InlineOutcomeCard from '@/components/fullPage/InlineOutcomeCard.vue'

const { canPay, busy, outcome } = defineProps<{
  canPay: boolean
  busy: boolean
  outcome?: Exclude<InlineOutcome, { kind: 'reconciling' }>
}>()

const emit = defineEmits<{ pay: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="mt-6 flex flex-col gap-4">
    <InlineOutcomeCard v-if="outcome" :outcome />
    <div class="flex flex-col items-center gap-1">
      <button
        type="button"
        :disabled="!canPay || busy"
        :class="
          cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'w-full font-semibold'
          )
        "
        @click="emit('pay')"
      >
        {{ t('checkout.fullPage.hostedMethods.pay') }}
      </button>
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('checkout.fullPage.hostedMethods.note') }}
      </p>
    </div>
  </div>
</template>
