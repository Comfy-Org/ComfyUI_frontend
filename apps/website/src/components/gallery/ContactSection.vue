<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="flex flex-col items-center px-4 pt-16 pb-24 text-center lg:px-20 lg:pt-20 lg:pb-40"
  >
    <span
      class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
    >
      {{ t('gallery.contact.label', locale) }}
    </span>
    <h2
      class="text-primary-comfy-canvas mt-4 text-3xl font-light whitespace-pre-line"
    >
      {{ t('gallery.contact.heading', locale) }}
    </h2>
    <a
      href="mailto:hello@comfy.org"
      class="border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink mt-8 inline-flex items-center justify-center rounded-2xl border-2 px-8 py-3 text-sm font-bold tracking-wider uppercase transition-colors"
    >
      {{ t('gallery.contact.cta', locale) }}
    </a>
  </section>
</template>
