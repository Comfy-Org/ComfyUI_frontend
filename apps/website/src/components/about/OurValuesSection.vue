<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import NodeBadge from '../common/NodeBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type TranslationKey = Parameters<typeof t>[0]

const values: {
  segments: Array<{ text: string }>
  bodyKey: TranslationKey
}[] = [
  {
    segments: [{ text: 'SHIP' }, { text: 'IT' }],
    bodyKey: 'about.values.card1.body'
  },
  {
    segments: [{ text: 'SHARE' }, { text: 'IT' }],
    bodyKey: 'about.values.card2.body'
  },
  {
    segments: [{ text: 'OPEN-SOURCE' }, { text: 'IT' }],
    bodyKey: 'about.values.card3.body'
  },
  {
    segments: [{ text: 'RESPECT' }, { text: 'THE CRAFT' }],
    bodyKey: 'about.values.card4.body'
  }
]
</script>

<template>
  <section class="px-6 py-24 lg:px-20 lg:py-32">
    <div class="mx-auto max-w-5xl text-center">
      <span
        class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
      >
        {{ t('about.values.label', locale) }}
      </span>
      <h2
        class="text-primary-comfy-canvas mt-6 text-3xl font-light lg:text-5xl"
      >
        {{ t('about.values.headingBefore', locale)
        }}<span class="text-primary-comfy-yellow font-semibold">{{
          t('about.values.headingHighlight', locale)
        }}</span
        >{{ t('about.values.headingAfter', locale) }}
      </h2>
    </div>

    <div class="mx-auto mt-16 max-w-5xl">
      <!-- Desktop layout -->
      <div class="hidden lg:block">
        <!-- Row 1: SHIP IT + SHARE IT -->
        <div class="grid grid-cols-2 gap-6">
          <div
            v-for="value in values.slice(0, 2)"
            :key="value.segments[0].text"
            class="rounded-3xl border border-white/10 bg-white/5 p-8"
          >
            <NodeBadge :segments="value.segments" segment-class="px-3" />
            <p class="text-primary-warm-white mt-4 text-sm/relaxed">
              {{ t(value.bodyKey, locale) }}
            </p>
          </div>
        </div>

        <!-- Connector line -->
        <div class="flex justify-end pr-12">
          <div class="bg-primary-comfy-yellow h-10 w-0.5" />
        </div>

        <!-- Row 2: OPEN-SOURCE IT -->
        <div class="rounded-3xl border border-white/10 bg-white/5 p-8">
          <NodeBadge :segments="values[2].segments" segment-class="px-3" />
          <p class="text-primary-warm-white mt-4 text-sm/relaxed">
            {{ t(values[2].bodyKey, locale) }}
          </p>
        </div>

        <!-- Connector line -->
        <div class="flex justify-center">
          <div class="bg-primary-comfy-yellow h-10 w-0.5" />
        </div>

        <!-- Row 3: RESPECT THE CRAFT -->
        <div class="rounded-3xl border border-white/10 bg-white/5 p-8">
          <NodeBadge :segments="values[3].segments" segment-class="px-3" />
          <p class="text-primary-warm-white mt-4 text-sm/relaxed">
            {{ t(values[3].bodyKey, locale) }}
          </p>
        </div>
      </div>

      <!-- Mobile: stacked cards -->
      <div class="flex flex-col gap-6 lg:hidden">
        <div
          v-for="value in values"
          :key="value.segments[0].text"
          class="rounded-3xl border border-white/10 bg-white/5 p-8"
        >
          <NodeBadge :segments="value.segments" segment-class="px-3" />
          <p class="text-primary-warm-white mt-4 text-sm/relaxed">
            {{ t(value.bodyKey, locale) }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
