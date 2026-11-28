<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { CheckoutTermsNote } from '@comfyorg/account-ui/billing/checkout'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type { InlineOutcome } from '@/checkout/checkoutPage'
import { termsCopy } from '@/checkout/termsCopy'
import InlineOutcomeCard from '@/components/fullPage/InlineOutcomeCard.vue'

const { canPay, busy, outcome } = defineProps<{
  canPay: boolean
  busy: boolean
  outcome?: Exclude<InlineOutcome, { kind: 'reconciling' }>
}>()

const emit = defineEmits<{ pay: [] }>()

const { t } = useI18n()

const terms = computed(() =>
  termsCopy(t, 'checkout.fullPage.terms.agreementOnce')
)
</script>

<template>
  <div class="mt-4 flex flex-col gap-4">
    <div class="flex items-center gap-3" aria-hidden="true">
      <span class="h-px flex-1 bg-border" />
      <span class="text-xs text-muted-foreground uppercase">
        {{ t('checkout.fullPage.hostedMethods.or') }}
      </span>
      <span class="h-px flex-1 bg-border" />
    </div>
    <InlineOutcomeCard v-if="outcome" :outcome />
    <div class="flex flex-col gap-2">
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
      <p class="m-0 text-center text-xs text-muted-foreground">
        {{ t('checkout.fullPage.hostedMethods.note') }}
      </p>
    </div>
    <CheckoutTermsNote :copy="terms" />
  </div>
</template>
