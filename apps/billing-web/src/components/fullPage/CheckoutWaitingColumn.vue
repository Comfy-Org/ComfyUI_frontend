<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * The payment column while money this page did not send is still going
 * through: the capture skeleton, no form, and one polite line that says so.
 * FE-3022 replaces it with the phase screens.
 */
const { t } = useI18n()
</script>

<template>
  <section class="flex lg:w-1/2" aria-busy="true">
    <div
      class="flex w-full flex-col gap-6 px-6 py-12 lg:max-w-lg lg:px-16"
      data-testid="checkout-waiting"
    >
      <p
        role="status"
        aria-live="polite"
        class="m-0 text-base font-semibold text-base-foreground"
      >
        {{ t('checkout.fullPage.waiting.status') }}
      </p>
      <p class="m-0 text-sm/5 text-muted-foreground">
        {{ t('checkout.fullPage.waiting.body') }}
      </p>
      <div
        class="h-84 rounded-lg bg-secondary-background-hover motion-safe:animate-pulse"
      />
      <div
        class="h-84 rounded-lg bg-secondary-background-hover motion-safe:animate-pulse"
      />
    </div>
  </section>
</template>
