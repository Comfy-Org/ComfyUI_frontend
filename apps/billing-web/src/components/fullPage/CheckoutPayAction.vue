<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { CheckoutTermsNote } from '@comfyorg/account-ui/billing/checkout'

const {
  disabled,
  loading = false,
  failure
} = defineProps<{
  disabled: boolean
  loading?: boolean
  failure?: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-4">
    <p
      v-if="failure"
      role="alert"
      class="m-0 text-sm text-destructive-background"
    >
      {{ failure }}
    </p>
    <button
      type="submit"
      :disabled="disabled || loading"
      :aria-busy="loading"
      class="h-10 w-full cursor-pointer rounded-lg bg-base-foreground px-4 text-sm font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    >
      {{ t('checkout.payAndSubscribe') }}
    </button>
    <CheckoutTermsNote
      :copy="{
        agreement: t('checkout.fullPage.terms.agreement', {
          terms: '{terms}',
          privacy: '{privacy}'
        }),
        terms: t('checkout.fullPage.terms.terms'),
        privacyPolicy: t('checkout.fullPage.terms.privacyPolicy')
      }"
    />
  </div>
</template>
