<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import CardGridSection from '../shared/CardGridSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const steps = [
  {
    number: '01',
    titleKey: 'api.steps.step1.title' as const,
    descriptionKey: 'api.steps.step1.description' as const,
    image: 'https://media.comfy.org/website/api/logo-purple.webp'
  },
  {
    number: '02',
    titleKey: 'api.steps.step2.title' as const,
    descriptionKey: 'api.steps.step2.description' as const,
    image: 'https://media.comfy.org/website/api/logo-yellow.webp'
  },
  {
    number: '03',
    titleKey: 'api.steps.step3.title' as const,
    descriptionKey: 'api.steps.step3.description' as const,
    image: 'https://media.comfy.org/website/api/logo-multicolor.webp'
  }
]
</script>

<template>
  <CardGridSection :heading="t('api.steps.heading', locale)" :columns="3">
    <div
      v-for="step in steps"
      :key="step.number"
      class="bg-primary-comfy-ink flex flex-col justify-between rounded-3xl border border-white/10"
    >
      <img
        :src="step.image"
        :alt="t(step.titleKey, locale)"
        class="w-full rounded-t-3xl object-contain p-8"
      />
      <div class="p-6 pt-0">
        <p class="text-primary-comfy-yellow text-sm font-bold tracking-wider">
          {{ step.number }}
        </p>
        <h3 class="text-primary-comfy-canvas mt-2 text-3xl font-medium">
          {{ t(step.titleKey, locale) }}
        </h3>
        <p class="mt-3 text-sm text-smoke-700">
          {{ t(step.descriptionKey, locale) }}
        </p>
      </div>
    </div>

    <!-- CTA buttons -->
    <template #footer>
      <div
        class="mt-12 flex flex-col items-center gap-4 lg:flex-row lg:justify-center"
      >
        <a
          :href="externalLinks.cloud"
          target="_blank"
          rel="noopener"
          class="bg-primary-comfy-yellow text-primary-comfy-ink w-full rounded-full px-8 py-4 text-center text-sm font-bold tracking-wider transition-opacity hover:opacity-90 lg:w-auto lg:min-w-48"
        >
          {{ t('api.hero.getApiKeys', locale) }}
        </a>
        <a
          :href="externalLinks.docs"
          target="_blank"
          rel="noopener"
          class="border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink w-full rounded-full border px-8 py-4 text-center text-sm font-bold tracking-wider transition-colors lg:w-auto lg:min-w-48"
        >
          {{ t('api.hero.viewDocs', locale) }}
        </a>
      </div>
    </template>
  </CardGridSection>
</template>
