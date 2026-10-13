<script setup lang="ts">
import { useMounted } from '@vueuse/core'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchBeforeAfterClip } from './types'

import CheckIcon from '../../components/icons/CheckIcon.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', showcase } = defineProps<{
  showcase: ModelLaunchBeforeAfterClip
  locale?: Locale
}>()

// Server markup carries no clip source, so nothing downloads until the island
// hydrates, which with client:visible is when it scrolls into view.
const isMounted = useMounted()
</script>

<template>
  <div
    class="flex flex-col items-stretch gap-10 rounded-5xl bg-transparency-white-t4 p-2 lg:flex-row lg:gap-8"
  >
    <div class="flex min-w-0 flex-1 flex-col p-6">
      <h2 class="text-3xl font-light text-primary-comfy-canvas lg:text-4xl">
        {{ t(showcase.headingKey, locale) }}
      </h2>
      <p
        v-if="showcase.bodyKey"
        class="mt-6 text-sm text-primary-comfy-canvas/70"
      >
        {{ t(showcase.bodyKey, locale) }}
      </p>
      <ul class="mt-8 space-y-3">
        <li
          v-for="feature in showcase.features"
          :key="feature.en"
          class="flex items-start gap-2.5 text-sm/relaxed font-light text-primary-comfy-canvas"
        >
          <CheckIcon
            class="mt-1 size-4 shrink-0 text-primary-comfy-yellow"
            aria-hidden="true"
          />
          {{ feature[locale] || feature.en }}
        </li>
      </ul>
      <a
        v-if="showcase.cta"
        :href="showcase.cta.href"
        :target="showcase.cta.target"
        :rel="
          showcase.cta.target === '_blank' ? 'noopener noreferrer' : undefined
        "
        class="mt-8 self-start rounded-sm text-sm font-bold tracking-wider text-primary-comfy-yellow uppercase underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      >
        {{ t(showcase.cta.labelKey, locale) }}
      </a>
    </div>
    <div class="w-full min-w-0 flex-1">
      <video
        data-testid="video-single"
        :src="isMounted ? showcase.src : undefined"
        autoplay
        loop
        muted
        playsinline
        aria-hidden="true"
        class="aspect-video w-full rounded-4.5xl bg-primary-comfy-ink object-cover"
      />
    </div>
  </div>
</template>
