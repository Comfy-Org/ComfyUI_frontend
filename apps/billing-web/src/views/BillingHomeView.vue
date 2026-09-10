<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main
    class="fixed inset-0 overflow-auto bg-ink-900 px-6 py-12 text-smoke-100"
  >
    <section
      aria-labelledby="billing-heading"
      class="mx-auto flex min-h-full max-w-3xl items-center"
    >
      <div class="w-full">
        <p class="mb-3 font-medium text-smoke-500">
          {{ t('billing.eyebrow') }}
        </p>
        <h1 id="billing-heading" class="mb-4 text-4xl font-semibold">
          {{ t('billing.title') }}
        </h1>
        <p class="max-w-2xl text-lg/8 text-smoke-500">
          {{ t('billing.description') }}
        </p>

        <dl
          class="mt-10 grid gap-px overflow-hidden rounded-2xl bg-ink-100 sm:grid-cols-2"
        >
          <div class="bg-ink-800 p-6">
            <dt class="text-smoke-500">
              {{ t('billing.accountIntegration') }}
            </dt>
            <dd class="mt-2 font-medium">{{ t('billing.pending') }}</dd>
          </div>
          <div class="bg-ink-800 p-6">
            <dt class="text-smoke-500">
              {{ t('billing.billingIntegration') }}
            </dt>
            <dd class="mt-2 font-medium">{{ t('billing.pending') }}</dd>
          </div>
        </dl>
      </div>
    </section>
  </main>
</template>
