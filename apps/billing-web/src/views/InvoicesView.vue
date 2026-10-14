<script setup lang="ts">
/**
 * Invoices live with the payment provider, the same way the cloud app's
 * "Invoice History" opens the portal rather than listing them itself. The
 * portal returns to this page, which has nothing to refresh.
 */
import { useI18n } from 'vue-i18n'

import HostedSurface from '@/components/HostedSurface.vue'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { usePaymentPortal } from '@/composables/usePaymentPortal'

const { t } = useI18n()
const { refusal } = useHostedCopy()
const {
  returningFromPortal,
  opening,
  refusal: failure,
  openPortal,
  dropReturnMarker
} = usePaymentPortal('invoices')

if (returningFromPortal) void dropReturnMarker()
</script>

<template>
  <HostedSurface>
    <section class="flex flex-col gap-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('hosted.invoices.body') }}
      </p>
      <p v-if="failure" class="m-0 text-sm text-destructive-background">
        {{ refusal(failure) }}
      </p>
      <button
        type="button"
        :disabled="opening"
        class="h-11 cursor-pointer self-start rounded-lg bg-base-foreground px-5 font-semibold text-base-background disabled:cursor-not-allowed disabled:opacity-40"
        @click="openPortal"
      >
        {{ t('hosted.invoices.open') }}
      </button>
    </section>
  </HostedSurface>
</template>
