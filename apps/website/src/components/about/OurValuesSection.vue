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
        }}<span class="text-primary-comfy-yellow">{{
          t('about.values.headingHighlight', locale)
        }}</span
        >{{ t('about.values.headingAfter', locale) }}
      </h2>
    </div>

    <div class="mx-auto mt-16 max-w-5xl">
      <!-- Desktop layout -->
      <div class="hidden lg:block">
        <!-- Row 1: SHIP IT + SHARE IT -->
        <div class="flex items-center gap-0">
          <div
            class="border-primary-comfy-yellow flex-1 rounded-3xl border p-8"
          >
            <NodeBadge
              :segments="values[0].segments"
              segment-class="lg:py-3"
              text-class="text-2xl lg:text-3xl"
            />
            <p class="text-primary-warm-white mt-4 text-sm/relaxed">
              {{ t(values[0].bodyKey, locale) }}
            </p>
          </div>
          <img
            src="/icons/node-link.svg"
            alt=""
            class="shrink-0"
            aria-hidden="true"
          />
          <div
            class="border-primary-comfy-yellow flex-1 rounded-3xl border p-8"
          >
            <NodeBadge
              :segments="values[1].segments"
              segment-class="lg:py-3"
              text-class="text-2xl lg:text-3xl"
            />
            <p class="text-primary-warm-white mt-4 text-sm/relaxed">
              {{ t(values[1].bodyKey, locale) }}
            </p>
          </div>
        </div>

        <!-- Connector line -->
        <div class="flex justify-end pr-12">
          <img
            src="/icons/node-link.svg"
            alt=""
            class="-my-1.5 rotate-90"
            aria-hidden="true"
          />
        </div>

        <!-- Row 2: OPEN-SOURCE IT -->
        <div class="border-primary-comfy-yellow rounded-3xl border p-8">
          <NodeBadge
            :segments="values[2].segments"
            segment-class="px-3"
            text-class="text-2xl lg:text-3xl"
          />
          <p class="text-primary-warm-white mt-4 text-sm/relaxed">
            {{ t(values[2].bodyKey, locale) }}
          </p>
        </div>

        <!-- Connector line -->
        <div class="flex justify-start pl-24">
          <img
            src="/icons/node-link.svg"
            alt=""
            class="-my-1.5 rotate-90"
            aria-hidden="true"
          />
        </div>

        <!-- Row 3: RESPECT THE CRAFT -->
        <div class="border-primary-comfy-yellow rounded-3xl border p-8">
          <NodeBadge
            :segments="values[3].segments"
            segment-class="px-3"
            text-class="text-2xl lg:text-3xl"
          />
          <p class="text-primary-warm-white mt-4 text-sm/relaxed">
            {{ t(values[3].bodyKey, locale) }}
          </p>
        </div>
      </div>

      <!-- Mobile: stacked cards -->
      <div class="flex flex-col items-center lg:hidden">
        <template v-for="(value, i) in values" :key="value.segments[0].text">
          <div
            v-if="i > 0"
            class="flex w-full"
            :class="i % 2 === 1 ? 'justify-end pr-16' : 'justify-start pl-16'"
          >
            <img
              src="/icons/node-link.svg"
              alt=""
              class="-my-1 w-3 shrink-0 rotate-90"
              aria-hidden="true"
            />
          </div>
          <div
            class="border-primary-comfy-yellow w-full rounded-3xl border p-8"
          >
            <NodeBadge
              :segments="value.segments"
              segment-class="px-3"
              text-class="text-2xl lg:text-3xl"
            />
            <p class="text-primary-warm-white mt-4 text-sm/relaxed">
              {{ t(value.bodyKey, locale) }}
            </p>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
