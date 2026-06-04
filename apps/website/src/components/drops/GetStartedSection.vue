<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface Step {
  number: string
  titleKey: TranslationKey
  bodyKey: TranslationKey
}

const steps: Step[] = [
  {
    number: '1',
    titleKey: 'drops-landing.getStarted.step.1.title',
    bodyKey: 'drops-landing.getStarted.step.1.body'
  },
  {
    number: '2',
    titleKey: 'drops-landing.getStarted.step.2.title',
    bodyKey: 'drops-landing.getStarted.step.2.body'
  },
  {
    number: '3',
    titleKey: 'drops-landing.getStarted.step.3.title',
    bodyKey: 'drops-landing.getStarted.step.3.body'
  }
]
</script>

<template>
  <section
    class="border-t border-primary-comfy-canvas/10 px-6 py-20 md:px-20 md:py-28"
    data-testid="drops-get-started"
  >
    <div class="mx-auto max-w-6xl text-center">
      <p
        class="text-sm tracking-widest text-primary-comfy-canvas/60 uppercase md:text-base"
      >
        {{ t('drops-landing.getStarted.eyebrow', locale) }}
      </p>
      <h2
        class="text-primary-comfy-yellow mt-2 text-4xl font-bold tracking-tight uppercase md:text-6xl"
      >
        {{ t('drops-landing.getStarted.headingAccent', locale) }}
      </h2>
    </div>

    <ol
      class="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8"
    >
      <li
        v-for="step in steps"
        :key="step.number"
        class="bg-transparency-white-t4 flex flex-col gap-4 rounded-4xl border border-primary-comfy-canvas/10 p-8"
        :data-testid="`drops-step-${step.number}`"
      >
        <span
          class="text-primary-comfy-yellow font-mono text-5xl font-light md:text-6xl"
          aria-hidden="true"
        >
          {{ step.number }}
        </span>
        <h3 class="text-2xl font-light text-primary-comfy-canvas">
          {{ t(step.titleKey, locale) }}
        </h3>
        <p class="text-base text-primary-comfy-canvas/70">
          {{ t(step.bodyKey, locale) }}
        </p>
      </li>
    </ol>
  </section>
</template>
