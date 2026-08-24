<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import SectionHeader from '../../components/common/SectionHeader.vue'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const principles = [
  {
    title: t('brand.voice.direct.title', locale),
    body: t('brand.voice.direct.body', locale)
  },
  {
    title: t('brand.voice.precise.title', locale),
    body: t('brand.voice.precise.body', locale)
  },
  {
    title: t('brand.voice.human.title', locale),
    body: t('brand.voice.human.body', locale)
  },
  {
    title: t('brand.voice.antihype.title', locale),
    body: t('brand.voice.antihype.body', locale)
  }
]

const doExamples = [
  t('brand.voice.do.0', locale),
  t('brand.voice.do.1', locale)
]

const dontExamples = [
  t('brand.voice.dont.0', locale),
  t('brand.voice.dont.1', locale)
]
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:px-20 lg:py-12">
    <SectionHeader align="start" max-width="xl">
      {{ t('brand.voice.heading', locale) }}
    </SectionHeader>

    <dl class="mt-10 flex max-w-4xl flex-col gap-3.5 text-sm leading-[1.6]">
      <div v-for="principle in principles" :key="principle.title">
        <dt class="text-primary-comfy-yellow">{{ principle.title }}</dt>
        <dd class="text-primary-warm-gray">{{ principle.body }}</dd>
      </div>
    </dl>

    <div class="mt-12 grid gap-4 md:grid-cols-2">
      <div class="bg-transparency-white-t4 flex flex-col gap-4 rounded-4xl p-8">
        <div class="flex items-center gap-2">
          <span
            class="bg-primary-comfy-yellow size-2.5 rounded-full"
            aria-hidden="true"
          />
          <span
            class="text-sm font-bold tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ t('brand.voice.doLabel', locale) }}
          </span>
        </div>
        <div
          v-for="example in doExamples"
          :key="example"
          class="bg-transparency-ink-t80 rounded-2xl p-5"
        >
          <p class="text-base/[1.45] text-primary-comfy-canvas">
            {{ example }}
          </p>
        </div>
      </div>

      <div class="bg-transparency-white-t4 flex flex-col gap-4 rounded-4xl p-8">
        <div class="flex items-center gap-2">
          <span
            class="bg-primary-warm-gray size-2.5 rounded-full"
            aria-hidden="true"
          />
          <span
            class="text-primary-warm-gray text-sm font-bold tracking-wider uppercase"
          >
            {{ t('brand.voice.dontLabel', locale) }}
          </span>
        </div>
        <div
          v-for="example in dontExamples"
          :key="example"
          class="bg-transparency-ink-t80 rounded-2xl p-5"
        >
          <p class="text-primary-warm-gray text-base/[1.45] line-through">
            {{ example }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
