<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="flex flex-col items-center px-4 pt-16 pb-24 text-center lg:px-20 lg:pt-10 lg:pb-40"
  >
    <span
      class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
    >
      {{ t('customers.contact.label', locale) }}
    </span>
    <h2
      class="text-primary-comfy-canvas mt-4 max-w-2xl text-3xl font-light whitespace-pre-line"
      v-html="t('customers.contact.heading', locale)"
    />
  </section>
</template>
