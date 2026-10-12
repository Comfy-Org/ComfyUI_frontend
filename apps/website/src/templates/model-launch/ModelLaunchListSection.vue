<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchList } from './types'

import { translationsFor } from '@/i18n/translations'

const { locale = 'en', list } = defineProps<{
  list: ModelLaunchList
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(list.headingKey) }}
      </h2>
    </div>

    <ul
      class="mx-auto mt-12 max-w-7xl divide-y divide-transparency-white-t8 border-y border-transparency-white-t8"
    >
      <li
        v-for="item in list.items"
        :key="item.id"
        class="flex items-start gap-5 py-8 lg:gap-8"
      >
        <a
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="item.title[locale] || item.title.en"
          class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-warm-white text-primary-comfy-ink transition-colors hover:bg-primary-comfy-yellow"
        >
          <ArrowRight class="size-5" :stroke-width="2.5" />
        </a>

        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold text-primary-warm-white lg:text-xl">
            <a
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
              class="transition-opacity hover:opacity-80"
            >
              {{ item.title[locale] || item.title.en }}
            </a>
          </h3>
          <p
            class="mt-2 max-w-3xl text-base/relaxed font-light text-primary-warm-gray"
          >
            {{ item.description[locale] || item.description.en }}
          </p>
          <p
            class="mt-3 flex flex-wrap gap-x-6 text-sm text-primary-warm-gray md:hidden"
          >
            <span v-for="(label, index) in item.meta" :key="index">
              {{ label[locale] || label.en }}
            </span>
          </p>
        </div>

        <div
          class="hidden shrink-0 items-start gap-12 pt-1.5 text-base text-primary-warm-gray md:flex lg:gap-20"
        >
          <span
            v-for="(label, index) in item.meta"
            :key="index"
            class="min-w-24 text-right"
          >
            {{ label[locale] || label.en }}
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>
