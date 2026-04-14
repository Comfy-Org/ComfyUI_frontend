<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { useDownloadUrl } from '../../../composables/useDownloadUrl'
import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { downloadUrl } = useDownloadUrl()
</script>

<template>
  <section class="overflow-hidden px-4 pt-20 pb-16 md:px-20 md:py-24">
    <div class="mx-auto flex max-w-5xl flex-col items-center">
      <div class="flex w-full max-w-2xl flex-col items-center text-center">
        <ProductHeroBadge />

        <h1
          class="text-primary-comfy-canvas mt-8 max-w-[10ch] text-5xl/tight font-light whitespace-pre-line md:max-w-none md:text-5xl"
        >
          {{ t('download.hero.heading', locale) }}
        </h1>

        <p
          class="text-primary-comfy-canvas mt-8 max-w-xs text-sm md:mt-20 md:max-w-xl md:text-base"
        >
          {{ t('download.hero.subtitle', locale) }}
        </p>

        <div
          class="mt-10 flex w-full max-w-md flex-col gap-4 md:w-auto md:max-w-none md:flex-row"
        >
          <a
            :href="downloadUrl"
            target="_blank"
            rel="noopener"
            class="bg-primary-comfy-yellow text-primary-comfy-ink rounded-full px-8 py-4 text-center text-sm font-bold tracking-wider transition-opacity hover:opacity-90 md:min-w-60"
          >
            {{ t('download.hero.downloadLocal', locale) }}
          </a>
          <a
            :href="externalLinks.github"
            class="border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink flex items-center justify-center gap-2 rounded-full border px-8 py-4 text-sm font-bold tracking-wider transition-colors md:min-w-60"
          >
            <span
              class="icon-mask size-5 mask-[url('/icons/social/github.svg')]"
              aria-hidden="true"
            />
            {{ t('download.hero.installGithub', locale) }}
          </a>
        </div>
      </div>

      <!-- Placeholder for future animation; clipped within hero section -->
      <div
        class="relative mt-4 flex h-104 w-full max-w-4xl items-start justify-center overflow-hidden md:mt-12 md:h-136 md:items-center"
      >
        <div
          class="border-secondary-mauve/35 bg-primary-comfy-ink/35 absolute top-20 left-2 h-64 w-44 rotate-30 rounded-4xl border"
        />
        <div
          class="border-secondary-mauve/35 bg-primary-comfy-ink/35 absolute top-28 left-20 h-56 w-40 rotate-30 rounded-4xl border"
        />
        <div
          class="border-secondary-mauve/35 bg-primary-comfy-ink/35 absolute top-52 right-4 h-56 w-40 rotate-30 rounded-4xl border"
        />

        <div class="relative z-10 mt-28 grid grid-cols-3 gap-0.5 md:mt-0">
          <span class="bg-secondary-mauve block size-9 rounded-lg" />
          <span class="bg-primary-comfy-plum block size-9 rounded-lg" />
          <span class="bg-secondary-mauve block size-9 rounded-lg" />
          <span class="bg-primary-comfy-plum block size-9 rounded-lg" />
          <span class="bg-primary-comfy-yellow block size-9 rounded-lg" />
          <span class="bg-secondary-mauve block size-9 rounded-lg" />
          <span class="bg-secondary-mauve block size-9 rounded-lg" />
          <span class="bg-primary-comfy-plum block size-9 rounded-lg" />
          <span class="bg-secondary-mauve block size-9 rounded-lg" />
        </div>
      </div>
    </div>
  </section>
</template>
