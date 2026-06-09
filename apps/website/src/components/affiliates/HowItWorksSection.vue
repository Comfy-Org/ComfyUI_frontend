<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionHeader from '../common/SectionHeader.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const steps: { titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  {
    titleKey: 'affiliate-landing.how.step.0.title',
    bodyKey: 'affiliate-landing.how.step.0.body'
  },
  {
    titleKey: 'affiliate-landing.how.step.1.title',
    bodyKey: 'affiliate-landing.how.step.1.body'
  },
  {
    titleKey: 'affiliate-landing.how.step.2.title',
    bodyKey: 'affiliate-landing.how.step.2.body'
  }
]
</script>

<template>
  <section
    class="px-6 py-20 md:px-20 md:py-28"
    data-testid="affiliate-how-it-works"
  >
    <SectionHeader>
      {{ t('affiliate-landing.how.heading', locale) }}
    </SectionHeader>
    <ol
      class="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8"
    >
      <li
        v-for="(step, index) in steps"
        :key="step.titleKey"
        class="bg-transparency-white-t4 border-primary-comfy-canvas/10 flex flex-col gap-4 rounded-4xl border p-8"
      >
        <span
          class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
        >
          {{ index + 1 }}
        </span>
        <h3 class="text-primary-comfy-canvas text-2xl font-light">
          {{ t(step.titleKey, locale) }}
        </h3>
        <p class="text-primary-comfy-canvas/70 text-sm">
          {{ t(step.bodyKey, locale) }}
        </p>
      </li>
    </ol>
  </section>
</template>
