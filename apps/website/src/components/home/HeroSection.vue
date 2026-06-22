<script setup lang="ts">
import { computed } from 'vue'

import HeroGraph from './HeroGraph.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const titleLines = computed(() => t('hero.title', locale).split('\n'))
</script>

<template>
  <section class="bg-primary-comfy-ink relative overflow-hidden">
    <div class="relative lg:h-[780px]">
      <div
        class="z-20 flex flex-col items-center px-6 pt-10 text-center lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-[150px] lg:pt-0"
      >
        <h1 class="flex flex-col items-center">
          <span class="relative">
            <span
              class="bg-primary-comfy-yellow font-formula-narrow text-primary-comfy-ink inline-block rounded-2xl px-5 py-2 text-4xl leading-none font-semibold uppercase lg:text-6xl"
            >
              {{ titleLines[0] }}
            </span>
            <span
              class="bg-primary-comfy-yellow absolute -bottom-1.5 left-1/2 size-4 -translate-x-1/2 rotate-45 rounded-[3px]"
            ></span>
          </span>
          <span
            class="bg-primary-comfy-yellow font-formula-narrow text-primary-comfy-ink mt-1.5 inline-block rounded-2xl px-5 py-2 text-4xl leading-none font-semibold uppercase lg:text-6xl"
          >
            {{ titleLines[1] }}
          </span>
        </h1>

        <p
          class="text-primary-comfy-canvas mt-8 max-w-md text-sm/relaxed lg:text-base"
        >
          {{ t('hero.subtitle', locale) }}
        </p>
      </div>

      <HeroGraph :locale class="lg:absolute lg:inset-0" />
    </div>
  </section>
</template>
