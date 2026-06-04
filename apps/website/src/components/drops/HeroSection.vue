<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import { captureDropClick } from './useDropClickCapture'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
const dropsUrl = `comfy.org${routes.drops}`
</script>

<template>
  <section
    class="max-w-9xl mx-auto px-6 pt-16 pb-12 text-center lg:px-20 lg:pt-28 lg:pb-20"
    data-testid="drops-hero"
  >
    <h1
      class="mx-auto max-w-5xl text-5xl/none font-light tracking-tight text-primary-comfy-canvas uppercase md:text-7xl/none lg:text-8xl/none"
    >
      <span class="block">{{ t('drops-landing.hero.eyebrow', locale) }}</span>
      <span class="text-primary-comfy-yellow block font-bold">
        {{ t('drops-landing.hero.headingAccent', locale) }}
      </span>
    </h1>
    <p
      class="mx-auto mt-10 max-w-2xl text-lg text-primary-comfy-canvas md:text-xl"
    >
      {{ t('drops-landing.hero.body1', locale) }}
    </p>
    <p
      class="mx-auto mt-4 max-w-2xl text-base text-primary-comfy-canvas/80 md:text-lg"
    >
      {{ t('drops-landing.hero.body2', locale) }}
    </p>
    <div
      class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
    >
      <BrandButton
        :href="externalLinks.liveDemoEvent"
        target="_blank"
        rel="noopener noreferrer"
        size="lg"
        data-testid="drops-hero-primary-cta"
        class="px-8 py-4 text-base"
        @click="
          captureDropClick('hero', {
            cta: 'explore_whats_new',
            href: externalLinks.liveDemoEvent
          })
        "
      >
        {{ t('drops-landing.hero.primaryCta', locale) }}
      </BrandButton>
      <BrandButton
        :href="externalLinks.workflows"
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        size="lg"
        data-testid="drops-hero-secondary-cta"
        class="px-8 py-4 text-base"
        @click="
          captureDropClick('hero', {
            cta: 'see_all_workflows',
            href: externalLinks.workflows
          })
        "
      >
        {{ t('drops-landing.hero.secondaryCta', locale) }}
      </BrandButton>
    </div>
    <a
      :href="routes.drops"
      class="mt-8 inline-block text-xs tracking-widest text-primary-comfy-canvas/40 uppercase"
    >
      {{ dropsUrl }}
    </a>
  </section>
</template>
