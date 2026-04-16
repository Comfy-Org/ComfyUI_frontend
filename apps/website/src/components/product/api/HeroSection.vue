<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="overflow-hidden px-4 pt-20 pb-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-5xl flex-col items-center">
      <div class="flex w-full max-w-2xl flex-col items-center text-center">
        <ProductHeroBadge text="API" />

        <h1
          class="text-primary-comfy-canvas mt-8 text-5xl/tight font-light whitespace-pre-line lg:text-5xl"
        >
          {{ t('api.hero.heading', locale) }}
        </h1>

        <p
          class="text-primary-comfy-canvas mt-8 max-w-xs text-sm lg:mt-20 lg:max-w-xl lg:text-base"
        >
          {{ t('api.hero.subtitle', locale) }}
        </p>

        <div
          class="mt-10 flex w-full max-w-md flex-col gap-4 lg:w-auto lg:max-w-none lg:flex-row"
        >
          <a
            :href="externalLinks.app"
            target="_blank"
            rel="noopener noreferrer"
            class="bg-primary-comfy-yellow text-primary-comfy-ink rounded-full px-8 py-4 text-center text-sm font-bold tracking-wider transition-opacity hover:opacity-90 lg:min-w-60"
          >
            {{ t('api.hero.getApiKeys', locale) }}
          </a>
          <a
            :href="externalLinks.docs"
            target="_blank"
            rel="noopener noreferrer"
            class="border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink rounded-full border px-8 py-4 text-center text-sm font-bold tracking-wider transition-colors lg:min-w-60"
          >
            {{ t('api.hero.viewDocs', locale) }}
          </a>
        </div>
      </div>

      <!-- Isometric node illustration -->
      <div
        class="relative mt-4 flex h-104 w-full max-w-4xl items-start justify-center overflow-hidden lg:mt-12 lg:h-136 lg:items-center"
      >
        <!-- Background layers -->
        <div
          class="border-secondary-mauve/20 absolute bottom-8 h-40 w-72 rounded-3xl border lg:bottom-16 lg:h-48 lg:w-96"
        />
        <div
          class="border-secondary-mauve/20 absolute bottom-16 h-40 w-60 rounded-3xl border lg:bottom-28 lg:h-48 lg:w-80"
        />
        <div
          class="border-secondary-mauve/20 absolute bottom-24 h-40 w-48 rounded-3xl border lg:bottom-40 lg:h-48 lg:w-64"
        />

        <!-- Isometric grid of nodes -->
        <div
          class="relative z-10 mt-28 grid grid-cols-5 gap-1 lg:mt-0 lg:gap-1.5"
          style="transform: rotateX(55deg) rotateZ(45deg)"
        >
          <span
            class="bg-primary-comfy-yellow block size-8 rounded-lg lg:size-10"
          />
          <span class="bg-secondary-mauve block size-8 rounded-lg lg:size-10" />
          <span
            class="bg-primary-comfy-plum block size-8 rounded-lg lg:size-10"
          />
          <span class="bg-secondary-mauve block size-8 rounded-lg lg:size-10" />
          <span
            class="bg-primary-comfy-yellow block size-8 rounded-lg lg:size-10"
          />

          <span class="bg-secondary-mauve block size-8 rounded-lg lg:size-10" />
          <span
            class="bg-primary-comfy-plum block size-8 rounded-lg lg:size-10"
          />
          <span
            class="bg-primary-comfy-yellow block size-8 rounded-lg lg:size-10"
          />
          <span
            class="bg-primary-comfy-plum block size-8 rounded-lg lg:size-10"
          />
          <span class="bg-secondary-mauve block size-8 rounded-lg lg:size-10" />

          <span
            class="bg-primary-comfy-plum block size-8 rounded-lg lg:size-10"
          />
          <span class="bg-secondary-mauve block size-8 rounded-lg lg:size-10" />
          <span
            class="bg-primary-comfy-plum block size-8 rounded-lg lg:size-10"
          />
          <span class="bg-secondary-mauve block size-8 rounded-lg lg:size-10" />
          <span
            class="bg-primary-comfy-plum block size-8 rounded-lg lg:size-10"
          />

          <span
            class="bg-primary-comfy-yellow block size-8 rounded-lg lg:size-10"
          />
          <span
            class="bg-primary-comfy-plum block size-8 rounded-lg lg:size-10"
          />
          <span class="bg-secondary-mauve block size-8 rounded-lg lg:size-10" />
          <span
            class="bg-primary-comfy-yellow block size-8 rounded-lg lg:size-10"
          />
          <span
            class="bg-primary-comfy-plum block size-8 rounded-lg lg:size-10"
          />
        </div>
      </div>
    </div>
  </section>
</template>
