<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import type { WorkshopBrowseModel } from '../../config/workshop'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

// Rendered without a client directive: nothing here is interactive, so this
// section ships as HTML and costs the homepage no JavaScript.
const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopBrowseModel[]
  locale?: Locale
}>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto bg-primary-comfy-ink px-4 py-20 lg:px-20 lg:py-24"
  >
    <div
      class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <p
          class="text-primary-comfy-yellow mb-5 text-sm font-medium tracking-widest uppercase"
        >
          {{ t('workshop.hero.eyebrow', locale) }}
        </p>
        <h2 class="text-5xl font-light text-primary-comfy-canvas">
          {{ t('home.workshop.heading', locale) }}
        </h2>
        <p class="mt-6 max-w-2xl text-base text-primary-comfy-canvas/70">
          {{ t('home.workshop.subheading', locale) }}
        </p>
      </div>

      <a
        href="/workshop/"
        class="hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow inline-flex shrink-0 items-center gap-2 rounded-full border border-primary-comfy-canvas/25 px-6 py-3 text-sm text-primary-comfy-canvas transition-colors"
      >
        {{ t('home.workshop.browseAll', locale) }}
        <ArrowRight aria-hidden="true" class="size-4" />
      </a>
    </div>

    <ul
      class="mt-12 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3"
    >
      <li v-for="model in models" :key="model.id">
        <a
          :href="model.href"
          class="group hover:border-primary-comfy-yellow/60 flex h-full flex-col rounded-2xl border border-primary-comfy-canvas/10 bg-primary-comfy-canvas/5 p-6 transition hover:-translate-y-0.5 hover:bg-primary-comfy-canvas/8"
        >
          <div class="flex items-center justify-between gap-4">
            <p
              class="text-primary-comfy-yellow text-xs tracking-wider uppercase"
            >
              {{ model.provider }}
            </p>
            <span
              class="rounded-full bg-primary-comfy-canvas/8 px-2.5 py-1 text-xs text-primary-comfy-canvas/60"
            >
              {{ model.output }}
            </span>
          </div>
          <h3 class="mt-3 text-xl font-semibold text-primary-comfy-canvas">
            {{ model.name }}
          </h3>
          <p class="mt-3 line-clamp-2 text-sm text-primary-comfy-canvas/65">
            {{ model.description }}
          </p>
          <ArrowRight
            aria-hidden="true"
            class="group-hover:text-primary-comfy-yellow mt-auto size-5 shrink-0 self-end pt-6 text-primary-comfy-canvas/50 transition-transform group-hover:translate-x-1"
          />
        </a>
      </li>
    </ul>
  </section>
</template>
