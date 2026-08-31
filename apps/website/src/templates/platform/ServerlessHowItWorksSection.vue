<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FeatureCard from './FeatureCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const stepNumbers = [2, 3] as const

const steps = stepNumbers.map((number) => ({
  title: t(`platform.serverlessDeploy.${number}.title`, locale),
  description: t(`platform.serverlessDeploy.${number}.description`, locale)
}))
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.serverlessDeploy.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ t('platform.serverlessDeploy.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <ol class="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
      <li v-for="step in steps" :key="step.title">
        <FeatureCard
          class="h-full"
          :title="step.title"
          :description="step.description"
        />
      </li>
    </ol>
  </section>
</template>
