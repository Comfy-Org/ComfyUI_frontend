<script setup lang="ts">
import SectionLabel from '../../components/common/SectionLabel.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const itemNumbers = [1, 2, 3, 4, 5] as const

const items = itemNumbers.map((n) => ({
  title: t(`platform.router.roadmap.${n}.title`, locale),
  description: t(`platform.router.roadmap.${n}.description`, locale)
}))
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <div class="mx-auto max-w-2xl text-center">
      <SectionLabel>{{
        t('platform.router.roadmap.eyebrow', locale)
      }}</SectionLabel>
      <h2
        class="mt-4 text-3xl font-light text-primary-comfy-canvas lg:text-4xl"
      >
        {{ t('platform.router.roadmap.header', locale) }}
      </h2>
      <p class="mt-4 text-sm/relaxed text-primary-comfy-canvas/80">
        {{ t('platform.router.roadmap.body', locale) }}
      </p>
    </div>

    <ol class="mx-auto mt-10 max-w-3xl list-none space-y-6 p-0">
      <li
        v-for="(item, index) in items"
        :key="item.title"
        class="bg-transparency-white-t4 flex gap-4 rounded-3xl p-5 lg:p-6"
      >
        <span
          class="text-primary-comfy-yellow shrink-0 font-semibold tabular-nums"
        >
          {{ String(index + 1).padStart(2, '0') }}
        </span>
        <div>
          <h3 class="text-base font-normal text-primary-warm-white">
            {{ item.title }}
          </h3>
          <p class="mt-2 text-sm/relaxed font-light text-primary-comfy-canvas">
            {{ item.description }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>
