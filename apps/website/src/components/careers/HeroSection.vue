<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import GlassCard from '../common/GlassCard.vue'
import SectionLabel from '../common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="px-6 pt-20 pb-16 md:pt-28 md:pb-24">
    <div class="mx-auto max-w-4xl text-center">
      <SectionLabel>
        {{ t('careers.hero.label', locale) }}
      </SectionLabel>
      <h1
        class="text-primary-comfy-canvas mt-4 text-4xl font-light whitespace-pre-line md:text-6xl"
      >
        {{ t('careers.hero.heading', locale) }}
      </h1>
    </div>

    <GlassCard class="mx-auto mt-12 max-w-3xl md:mt-16">
      <img
        src="https://media.comfy.org/website/careers/hero.webp"
        alt="Comfy team"
        class="w-full rounded-4xl object-cover"
      />
      <div class="text-primary-comfy-canvas space-y-6 p-8 text-base/relaxed">
        <p>{{ t('careers.hero.body1', locale) }}</p>
        <p>{{ t('careers.hero.body2', locale) }}</p>
        <p>{{ t('careers.hero.body3', locale) }}</p>
        <p>{{ t('careers.hero.body4', locale) }}</p>
      </div>
    </GlassCard>
  </section>
</template>
