<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'
import { usePaymentMethods } from '@comfyorg/account-ui/billing'

import { useHostedCopy } from '@/composables/useHostedCopy'
import { usePaymentPortal } from '@/composables/usePaymentPortal'

const { t } = useI18n()
const { coded, refusal } = useHostedCopy()
const {
  returningFromPortal,
  opening: openingPortal,
  refusal: portalRefusal,
  openPortal,
  dropReturnMarker
} = usePaymentPortal('payment_methods')

const { methods, defaultMethod, loading, failure, invalidateAndRefresh } =
  usePaymentMethods({ immediate: !returningFromPortal })

const rows = computed(() =>
  (methods.value ?? []).map((method) => ({
    id: method.id,
    label: describe(method),
    isDefault: method.id === defaultMethod.value?.id
  }))
)

function describe(method: SavedPaymentMethod): string {
  if (method.brand === undefined || method.last4 === undefined)
    return coded('paymentMethodType', method.type)
  return t('hosted.paymentMethods.card', {
    brand: method.brand,
    last4: method.last4
  })
}

async function resumeFromPortal() {
  await invalidateAndRefresh()
  await dropReturnMarker()
}

if (returningFromPortal) void resumeFromPortal()
</script>

<template>
  <section class="flex flex-col gap-4">
    <p v-if="loading" class="m-0 text-sm text-muted-foreground">
      {{ t('hosted.loading') }}
    </p>
    <p v-if="failure" class="m-0 text-sm text-destructive-background">
      {{ refusal(failure) }}
    </p>
    <p
      v-if="!loading && !failure && rows.length === 0"
      class="m-0 text-sm text-muted-foreground"
    >
      {{ t('hosted.paymentMethods.empty') }}
    </p>

    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="row in rows"
        :key="row.id"
        class="flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-secondary-background px-4 py-3"
      >
        <span class="text-sm text-base-foreground">{{ row.label }}</span>
        <span v-if="row.isDefault" class="text-xs text-muted-foreground">
          {{ t('hosted.paymentMethods.default') }}
        </span>
      </li>
    </ul>

    <p v-if="portalRefusal" class="m-0 text-sm text-destructive-background">
      {{ refusal(portalRefusal) }}
    </p>
    <button
      type="button"
      :disabled="openingPortal"
      class="h-11 cursor-pointer self-start rounded-lg bg-base-foreground px-5 font-semibold text-base-background disabled:cursor-not-allowed disabled:opacity-40"
      @click="openPortal"
    >
      {{ t('hosted.paymentMethods.manage') }}
    </button>
  </section>
</template>
