<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:px-16 lg:py-24">
    <blockquote
      class="mx-auto flex max-w-4xl flex-col justify-between rounded-3xl bg-transparency-white-t4 p-8 lg:p-12"
    >
      <p class="text-2xl/relaxed font-light text-primary-comfy-canvas">
        "{{ t('customers.feedback.quote1', locale) }}"
      </p>
      <footer class="mt-12">
        <p class="text-base font-medium text-primary-comfy-yellow">
          {{ t('customers.feedback.name1', locale) }},
        </p>
        <p class="text-base font-medium text-primary-comfy-yellow">
          {{ t('customers.feedback.role1', locale) }}
        </p>
      </footer>
    </blockquote>
  </section>
</template>
