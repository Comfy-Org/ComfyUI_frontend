<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useHostedCopy } from '@/composables/useHostedCopy'
import { usePaymentPortal } from '@/composables/usePaymentPortal'

const { t } = useI18n()
const { refusal } = useHostedCopy()
const {
  returningFromPortal,
  opening,
  refusal: portalRefusal,
  openPortal,
  dropReturnMarker
} = usePaymentPortal('payment_methods')

if (returningFromPortal) void dropReturnMarker()
else void openPortal()
</script>

<template>
  <section class="flex flex-col gap-4">
    <p v-if="opening" class="m-0 text-sm text-muted-foreground">
      {{ t('hosted.paymentMethods.opening') }}
    </p>
    <p v-if="portalRefusal" class="m-0 text-sm text-destructive">
      {{ refusal(portalRefusal) }}
    </p>
    <button
      v-if="!opening"
      type="button"
      class="h-11 cursor-pointer self-start rounded-lg bg-foreground px-5 font-semibold text-background"
      @click="openPortal"
    >
      {{ t('hosted.paymentMethods.manage') }}
    </button>
  </section>
</template>
