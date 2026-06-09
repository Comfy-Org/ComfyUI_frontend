<script setup lang="ts">
import type {
  Locale,
  LocalizedText,
  TranslationKey
} from '../../i18n/translations'

import { t } from '../../i18n/translations'
import BrandButton from './BrandButton.vue'

export type EventItem = {
  label: LocalizedText
  title: LocalizedText
  cta: LocalizedText
  href: string
}

const {
  locale = 'en',
  headingKey,
  descriptionKey,
  notifyLabelKey,
  notifyHref,
  events
} = defineProps<{
  locale?: Locale
  headingKey: TranslationKey
  descriptionKey: TranslationKey
  notifyLabelKey: TranslationKey
  notifyHref?: string
  events: readonly EventItem[]
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12">
    <div
      class="bg-transparency-white-t4 rounded-4xl px-6 py-12 lg:px-16 lg:py-20"
    >
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <div class="flex flex-col gap-8">
          <h2
            class="text-primary-comfy-canvas text-4xl font-light tracking-tight lg:text-6xl"
          >
            {{ t(headingKey, locale) }}
          </h2>
          <p
            class="text-primary-comfy-canvas max-w-sm text-sm/relaxed lg:text-base"
          >
            {{ t(descriptionKey, locale) }}
          </p>
          <div>
            <BrandButton
              :href="notifyHref"
              variant="outline"
              size="xs"
              class="uppercase"
            >
              {{ t(notifyLabelKey, locale) }}
            </BrandButton>
          </div>
        </div>

        <div class="flex flex-col">
          <a
            v-for="(event, i) in events"
            :key="i"
            :href="event.href"
            class="group border-primary-comfy-canvas/15 flex items-center gap-4 border-b py-6 lg:gap-8"
          >
            <span
              class="text-primary-comfy-canvas shrink-0 text-sm font-medium"
            >
              {{ event.label[locale] }}
            </span>
            <span class="text-primary-warm-gray flex-1 text-sm">
              {{ event.title[locale] }}
            </span>
            <span
              class="text-primary-comfy-yellow flex shrink-0 items-center gap-2 text-sm"
            >
              {{ event.cta[locale] }}
              <svg
                class="size-4 transition-transform group-hover:translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
