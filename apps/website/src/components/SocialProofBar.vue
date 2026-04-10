<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const logos = [
  'Harman',
  'Tencent',
  'Nike',
  'HP',
  'Autodesk',
  'Apple',
  'Ubisoft',
  'Lucid',
  'Amazon',
  'Netflix',
  'Pixomondo',
  'EA'
]

const metrics = computed(() => [
  { value: '60K+', label: t('social.customNodes', locale) },
  { value: '106K+', label: t('social.githubStars', locale) },
  { value: '500K+', label: t('social.communityMembers', locale) }
])
</script>

<template>
  <section class="border-y border-white/10 bg-black py-16">
    <div class="mx-auto max-w-7xl px-6">
      <!-- Heading -->
      <p
        class="text-center text-xs font-medium uppercase tracking-widest text-smoke-700"
      >
        {{ t('social.heading', locale) }}
      </p>

      <!-- Logo row -->
      <div
        class="mt-10 flex flex-wrap items-center justify-center gap-4 md:gap-6"
      >
        <span
          v-for="company in logos"
          :key="company"
          class="rounded-full border border-white/10 px-6 py-2 text-sm text-smoke-700"
        >
          {{ company }}
        </span>
      </div>

      <!-- Metrics row -->
      <div
        class="mt-14 flex flex-col items-center justify-center gap-10 sm:flex-row sm:gap-12"
      >
        <div v-for="metric in metrics" :key="metric.label" class="text-center">
          <p class="text-3xl font-bold text-white">{{ metric.value }}</p>
          <p class="mt-1 text-sm text-smoke-700">{{ metric.label }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
