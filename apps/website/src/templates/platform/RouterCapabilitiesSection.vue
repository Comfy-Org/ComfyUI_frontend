<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="mx-auto max-w-4xl px-6 py-10 lg:py-14">
    <div class="border-t border-primary-comfy-canvas/10 pt-10 lg:pt-14">
      <h3
        class="text-2xl/tight font-light text-primary-comfy-canvas lg:text-3xl/tight"
      >
        {{ t('platform.router.section1.heading', locale) }}
      </h3>
      <p class="mt-4 text-sm/relaxed text-primary-comfy-canvas/80">
        {{ t('platform.router.section1.body', locale) }}
      </p>
    </div>

    <div
      class="mt-14 border-t border-primary-comfy-canvas/10 pt-10 lg:mt-20 lg:pt-14"
    >
      <h3
        class="text-2xl/tight font-light text-primary-comfy-canvas lg:text-3xl/tight"
      >
        {{ t('platform.router.section2.heading', locale) }}
      </h3>
      <p class="mt-4 text-sm/relaxed text-primary-comfy-canvas/80">
        {{ t('platform.router.section2.body', locale) }}
      </p>

      <p
        class="mt-8 text-xs font-medium tracking-wide text-primary-comfy-canvas/50 uppercase"
      >
        {{ t('platform.router.section2.providersLabel', locale) }}
      </p>
      <p class="mt-2 text-base font-medium text-primary-comfy-canvas">
        {{ t('platform.router.section2.providers', locale) }}
      </p>

      <div
        class="mt-10 rounded-3xl border border-white/10 bg-transparency-white-t4 p-6 lg:p-8"
      >
        <h4 class="text-lg font-normal text-primary-warm-white">
          {{ t('platform.router.section2.calloutHeading', locale) }}
        </h4>
        <p class="mt-2 text-sm/relaxed text-primary-comfy-canvas/80">
          {{ t('platform.router.section2.calloutBody', locale) }}
        </p>
      </div>
    </div>
  </section>
</template>
