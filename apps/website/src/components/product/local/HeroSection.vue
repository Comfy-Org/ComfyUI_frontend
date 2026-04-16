<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { useDownloadUrl } from '../../../composables/useDownloadUrl'
import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { downloadUrl } = useDownloadUrl()
</script>

<template>
  <section class="overflow-hidden px-4 pt-20 pb-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-5xl flex-col items-center">
      <div class="flex w-full max-w-2xl flex-col items-center text-center">
        <ProductHeroBadge />

        <h1
          class="text-primary-comfy-canvas mt-8 max-w-[10ch] text-5xl/tight font-light whitespace-pre-line lg:max-w-none lg:text-5xl"
        >
          {{ t('download.hero.heading', locale) }}
        </h1>

        <p
          class="text-primary-comfy-canvas mt-8 max-w-xs text-sm lg:mt-20 lg:max-w-xl lg:text-base"
        >
          {{ t('download.hero.subtitle', locale) }}
        </p>

        <div
          class="mt-10 flex w-full max-w-md flex-col gap-4 lg:w-auto lg:max-w-none lg:flex-row"
        >
          <BrandButton
            :href="downloadUrl"
            :label="t('download.hero.downloadLocal', locale)"
            size="lg"
            class-name="text-center lg:min-w-60"
          />
          <BrandButton
            :href="externalLinks.github"
            variant="outline"
            size="lg"
            class-name="flex items-center justify-center gap-2 lg:min-w-60"
          >
            <span
              class="icon-mask size-5 mask-[url('/icons/social/github.svg')]"
              aria-hidden="true"
            />
            {{ t('download.hero.installGithub', locale) }}
          </BrandButton>
        </div>
      </div>

      <!-- Placeholder for future animation; clipped within hero section -->
      <div
        class="relative mt-4 flex h-104 w-full max-w-4xl items-start justify-center overflow-hidden lg:mt-12 lg:h-136 lg:items-center"
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

        <div class="relative z-10 mt-28 grid grid-cols-3 gap-0.5 lg:mt-0">
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
