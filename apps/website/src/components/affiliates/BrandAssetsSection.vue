<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionHeader from '../common/SectionHeader.vue'
import { brandAssets } from './brandAssets'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="px-6 py-20 md:px-20 md:py-28"
    data-testid="affiliate-brand-assets"
  >
    <SectionHeader>
      {{ t('affiliate-landing.assets.heading', locale) }}
      <template #subtitle>
        <p
          class="text-primary-comfy-canvas/70 mx-auto mt-4 max-w-2xl text-base"
        >
          {{ t('affiliate-landing.assets.subheading', locale) }}
        </p>
      </template>
    </SectionHeader>
    <ul
      class="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      <li
        v-for="asset in brandAssets"
        :key="asset.id"
        class="bg-transparency-white-t4 border-primary-comfy-canvas/10 flex flex-col overflow-hidden rounded-4xl border"
        :data-testid="`affiliate-asset-${asset.id}`"
      >
        <div
          class="bg-primary-comfy-ink/40 flex aspect-video items-center justify-center overflow-hidden p-6"
        >
          <img
            v-if="asset.preview"
            :src="asset.preview"
            :alt="t(asset.titleKey, locale)"
            class="max-h-full max-w-full object-contain"
            loading="lazy"
            decoding="async"
          />
          <span
            v-else
            class="text-primary-comfy-canvas/60 text-xs tracking-widest uppercase"
            aria-hidden="true"
          >
            {{ t(asset.titleKey, locale) }}
          </span>
        </div>
        <div class="flex flex-1 flex-col gap-2 p-5">
          <h3 class="text-primary-comfy-canvas text-base font-light">
            {{ t(asset.titleKey, locale) }}
          </h3>
          <a
            :href="asset.download"
            :download="
              asset.downloadFilename ?? asset.download.split('/').pop()
            "
            class="text-primary-comfy-yellow mt-auto inline-flex items-center gap-1 text-sm font-bold tracking-wider uppercase hover:underline"
          >
            {{ t('affiliate-landing.assets.downloadLabel', locale) }}
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </li>
    </ul>
  </section>
</template>
