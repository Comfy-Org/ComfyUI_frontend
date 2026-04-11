<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const pillars = computed(() => [
  {
    icon: '⚡',
    title: t('pillars.buildTitle', locale),
    description: t('pillars.buildDesc', locale)
  },
  {
    icon: '🎨',
    title: t('pillars.customizeTitle', locale),
    description: t('pillars.customizeDesc', locale)
  },
  {
    icon: '🔧',
    title: t('pillars.refineTitle', locale),
    description: t('pillars.refineDesc', locale)
  },
  {
    icon: '⚙️',
    title: t('pillars.automateTitle', locale),
    description: t('pillars.automateDesc', locale)
  },
  {
    icon: '🚀',
    title: t('pillars.runTitle', locale),
    description: t('pillars.runDesc', locale)
  }
])
</script>

<template>
  <section class="bg-black px-6 py-24">
    <div class="mx-auto max-w-7xl">
      <header class="mb-16 text-center">
        <h2 class="text-3xl font-bold text-white md:text-4xl">
          {{ t('pillars.heading', locale) }}
        </h2>
        <p class="mt-4 text-smoke-700">
          {{ t('pillars.subheading', locale) }}
        </p>
      </header>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <article
          v-for="pillar in pillars"
          :key="pillar.title"
          class="rounded-xl border border-white/10 bg-charcoal-600 p-6 transition-colors hover:border-brand-yellow"
        >
          <div
            class="flex size-12 items-center justify-center rounded-full bg-brand-yellow text-xl"
          >
            {{ pillar.icon }}
          </div>
          <h3 class="mt-4 text-lg font-semibold text-white">
            {{ pillar.title }}
          </h3>
          <p class="mt-2 text-sm text-smoke-700">
            {{ pillar.description }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
