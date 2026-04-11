<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctaButtons = computed(() => [
  {
    label: t('hero.cta.getStarted', locale),
    href: 'https://app.comfy.org',
    variant: 'solid' as const
  },
  {
    label: t('hero.cta.learnMore', locale),
    href: '/about',
    variant: 'outline' as const
  }
])
</script>

<template>
  <section
    class="relative flex min-h-screen items-center overflow-hidden bg-black pt-16"
  >
    <div
      class="mx-auto flex w-full max-w-7xl flex-col items-center gap-12 px-6 md:flex-row md:gap-0"
    >
      <!-- Left: C Monogram -->
      <div class="flex w-full items-center justify-center md:w-[55%]">
        <div class="relative -ml-12 -rotate-15 md:-ml-24" aria-hidden="true">
          <div
            class="size-64 rounded-full border-40 border-brand-yellow md:h-112 md:w-md md:border-64 lg:h-144 lg:w-xl lg:border-80"
          >
            <!-- Gap on the right side to form "C" shape -->
            <div
              class="absolute top-1/2 right-0 h-32 w-24 translate-x-1/2 -translate-y-1/2 bg-black md:h-48 md:w-36 lg:h-64 lg:w-48"
            />
          </div>
        </div>
      </div>

      <!-- Right: Text content -->
      <div class="flex w-full flex-col items-start md:w-[45%]">
        <h1
          class="text-5xl/tight font-bold tracking-tight text-white md:text-6xl lg:text-7xl"
        >
          {{ t('hero.headline', locale) }}
        </h1>

        <p class="mt-6 max-w-lg text-lg text-smoke-700">
          {{ t('hero.subheadline', locale) }}
        </p>

        <div class="mt-8 flex flex-wrap gap-4">
          <a
            v-for="btn in ctaButtons"
            :key="btn.label"
            :href="btn.href"
            class="rounded-full px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            :class="
              btn.variant === 'solid'
                ? 'bg-brand-yellow text-black'
                : 'border border-brand-yellow text-brand-yellow'
            "
          >
            {{ btn.label }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
