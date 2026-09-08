<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { resolveRel } from '../../utils/cta'
import { cloudNodeModelCards } from './modelCards'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <SectionHeader max-width="xl">
      {{ t('cloudNodesLaunch.models.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700 lg:text-base">
          {{ t('cloudNodesLaunch.models.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <ul
      class="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3"
    >
      <li
        v-for="card in cloudNodeModelCards"
        :key="card.titleKey"
        class="group relative overflow-hidden rounded-3xl bg-black/40"
      >
        <video
          v-if="card.media.kind === 'video'"
          :src="card.media.src"
          :aria-label="t(card.titleKey, locale)"
          class="aspect-square size-full object-cover transition-transform duration-300 group-hover:scale-105"
          autoplay
          loop
          muted
          playsinline
        />
        <img
          v-else
          :src="card.media.src"
          :alt="t(card.titleKey, locale)"
          class="aspect-square size-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />

        <div
          class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-black/85 to-transparent p-5"
        >
          <h3 class="text-base font-medium text-primary-comfy-canvas">
            {{ t(card.titleKey, locale) }}
          </h3>
          <span
            class="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs whitespace-nowrap text-primary-comfy-canvas backdrop-blur-sm"
          >
            {{ t(card.nodesKey, locale) }}
          </span>
        </div>
      </li>
    </ul>

    <p class="mt-8 text-center text-sm text-smoke-700">
      {{ t('cloudNodesLaunch.models.footnote', locale) }}
      <a
        :href="externalLinks.docsCloudNodes"
        target="_blank"
        :rel="resolveRel({ target: '_blank' })"
        class="underline underline-offset-4"
      >
        {{ t('cloudNodesLaunch.models.footnoteLink', locale) }}
      </a>
    </p>
  </section>
</template>
