<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <section class="overflow-hidden px-4 pt-20 pb-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-5xl flex-col items-center">
      <div class="flex w-full max-w-2xl flex-col items-center text-center">
        <ProductHeroBadge text="ENTERPRISE" />

        <h1
          class="text-primary-comfy-canvas mt-8 text-5xl/tight font-light whitespace-pre-line lg:text-5xl"
        >
          {{ t('enterprise.hero.heading', locale) }}
        </h1>

        <p
          class="text-primary-comfy-canvas mt-8 max-w-xs text-sm lg:mt-20 lg:max-w-xl lg:text-base"
        >
          {{ t('enterprise.hero.subtitle', locale) }}
        </p>

        <div
          class="mt-10 flex w-full max-w-md flex-col lg:w-auto lg:max-w-none"
        >
          <a
            :href="routes.contact"
            class="bg-primary-comfy-yellow text-primary-comfy-ink rounded-full px-8 py-4 text-center text-sm font-bold tracking-wider transition-opacity hover:opacity-90 lg:min-w-60"
          >
            {{ t('enterprise.hero.contactSales', locale) }}
          </a>
        </div>
      </div>

      <!-- Illustration -->
      <div
        class="relative mt-4 flex h-104 w-full max-w-4xl items-start justify-center overflow-hidden lg:mt-12 lg:h-136 lg:items-center"
      >
        <!-- Background hexagonal outlines -->
        <div
          class="border-secondary-mauve/20 absolute top-12 size-64 rounded-3xl border lg:top-8 lg:size-80"
        />
        <div
          class="border-secondary-mauve/20 absolute top-20 size-56 rounded-3xl border lg:top-16 lg:size-72"
        />

        <!-- Isometric node clusters -->
        <div class="relative z-10 mt-20 flex gap-4 lg:mt-0 lg:gap-6">
          <div
            class="grid transform-[rotateX(55deg)_rotateZ(45deg)] grid-cols-3 gap-0.5"
          >
            <span
              class="bg-secondary-mauve block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-plum block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-yellow block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-yellow block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-warm-gray block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-secondary-mauve block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-plum block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-yellow block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-secondary-mauve block size-7 rounded-lg lg:size-9"
            />
          </div>
          <div
            class="grid transform-[rotateX(55deg)_rotateZ(45deg)] grid-cols-3 gap-0.5"
          >
            <span
              class="bg-primary-warm-gray block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-yellow block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-secondary-mauve block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-secondary-mauve block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-plum block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-warm-gray block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-yellow block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-secondary-mauve block size-7 rounded-lg lg:size-9"
            />
            <span
              class="bg-primary-comfy-plum block size-7 rounded-lg lg:size-9"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
