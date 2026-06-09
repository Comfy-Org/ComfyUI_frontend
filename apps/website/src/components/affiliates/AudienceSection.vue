<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionHeader from '../common/SectionHeader.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const audienceKeys: TranslationKey[] = [
  'affiliate-landing.audience.item.0',
  'affiliate-landing.audience.item.1',
  'affiliate-landing.audience.item.2',
  'affiliate-landing.audience.item.3',
  'affiliate-landing.audience.item.4'
]
</script>

<template>
  <section
    class="px-6 py-20 md:px-20 md:py-28"
    data-testid="affiliate-audience"
  >
    <SectionHeader>
      {{ t('affiliate-landing.audience.heading', locale) }}
    </SectionHeader>
    <ul class="mx-auto mt-12 flex max-w-3xl flex-col gap-4">
      <li
        v-for="key in audienceKeys"
        :key="key"
        class="text-primary-comfy-canvas flex items-start gap-4 text-base md:text-lg"
      >
        <span
          class="bg-primary-comfy-yellow text-primary-comfy-ink mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          aria-hidden="true"
        >
          ✓
        </span>
        <span>{{ t(key, locale) }}</span>
      </li>
    </ul>
  </section>
</template>
