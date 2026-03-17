<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const pillars = computed(() => [
  {
    icon: '⚡',
    title: t('pillars.build', locale),
    description: t('pillars.build.desc', locale)
  },
  {
    icon: '🎨',
    title: t('pillars.customize', locale),
    description: t('pillars.customize.desc', locale)
  },
  {
    icon: '🔧',
    title: t('pillars.refine', locale),
    description: t('pillars.refine.desc', locale)
  },
  {
    icon: '⚙️',
    title: t('pillars.automate', locale),
    description: t('pillars.automate.desc', locale)
  },
  {
    icon: '🚀',
    title: t('pillars.run', locale),
    description: t('pillars.run.desc', locale)
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
            class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow text-xl"
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
