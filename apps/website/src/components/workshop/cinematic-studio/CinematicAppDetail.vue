<script setup lang="ts">
import { Play } from '@lucide/vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { CINEMATIC_STUDIO_APP_SLUG } from '@/lib/workshop/cinematic-studio/analytics'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import AppRepoLink from './AppRepoLink.vue'
import AppsBackLink from './AppsBackLink.vue'
import CinematicDetailControls from './CinematicDetailControls.vue'
import CinematicDetailModels from './CinematicDetailModels.vue'
import CinematicDetailStarters from './CinematicDetailStarters.vue'

const {
  models,
  cover,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  cover?: { url: string; poster?: string }
  locale?: Locale
}>()
const emit = defineEmits<{ try: [starter?: string] }>()
const { t } = translationsFor(locale)

const EXAMPLES = [
  'neon-street',
  'red-coat',
  'diner',
  'bus-stop',
  'motel',
  'letter'
] as const

const heroTry = useTemplateRef<HTMLElement>('heroTry')
const heroTryVisible = ref(true)
useIntersectionObserver(heroTry, ([entry]) => {
  heroTryVisible.value = entry?.isIntersecting ?? true
})
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-4 pt-8 pb-24 sm:px-8 sm:pb-16 lg:px-14"
    data-testid="cinematic-detail"
  >
    <AppsBackLink :locale class="mb-6" />
    <section class="grid items-center gap-10 lg:grid-cols-5 lg:gap-14">
      <div class="flex flex-col items-start gap-5 lg:col-span-2">
        <span
          class="font-mono text-xs tracking-wider text-primary-comfy-yellow uppercase"
        >
          {{ t('cinematic.detail.eyebrow') }}
        </span>
        <div class="flex flex-wrap items-center gap-3">
          <h1
            class="text-4xl font-semibold tracking-tight text-primary-warm-white lg:text-6xl"
          >
            {{ t('cinematic.title') }}
          </h1>
          <span
            class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ t('cinematic.beta') }}
          </span>
        </div>
        <p class="text-lg text-primary-warm-gray lg:text-xl">
          {{ t('cinematic.lead') }}
        </p>
        <div
          ref="heroTry"
          class="flex w-full flex-wrap items-center gap-3 sm:w-auto"
        >
          <Button
            type="button"
            size="lg"
            :prepend-icon="Play"
            class="w-full sm:w-auto"
            data-testid="cinematic-try"
            @click="emit('try')"
          >
            {{ t('cinematic.detail.try') }}
          </Button>
          <AppRepoLink
            :repo="workshopAppRepo('studio')"
            :app-slug="CINEMATIC_STUDIO_APP_SLUG"
            :locale
          />
        </div>
        <p class="text-sm text-primary-warm-gray">
          {{ t('cinematic.detail.modelCount', { count: models.length }) }}
          · {{ t('cinematic.detail.openSource') }}
        </p>
      </div>
      <div
        class="aspect-video overflow-hidden rounded-3xl bg-transparency-white-t4 shadow-2xl ring-1 ring-transparency-white-t8 lg:col-span-3"
      >
        <video
          v-if="cover"
          :src="cover.url"
          :poster="cover.poster"
          class="size-full object-cover"
          autoplay
          muted
          loop
          playsinline
          aria-hidden="true"
        />
      </div>
    </section>

    <CinematicDetailControls :locale class="mt-24" />
    <CinematicDetailStarters
      :locale
      class="mt-24"
      @use="(starter) => emit('try', starter)"
    />

    <section class="mt-24" aria-labelledby="cinematic-examples">
      <h2
        id="cinematic-examples"
        class="text-2xl font-semibold text-primary-warm-white lg:text-4xl"
      >
        {{ t('cinematic.detail.examplesTitle') }}
      </h2>
      <ul class="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        <li
          v-for="(name, index) in EXAMPLES"
          :key="name"
          class="aspect-video overflow-hidden rounded-2xl"
        >
          <img
            :src="`/images/cinematic-studio/${name}.jpg`"
            :alt="t('cinematic.detail.exampleAlt', { n: index + 1 })"
            class="size-full object-cover transition duration-500 hover:scale-105"
            loading="lazy"
          />
        </li>
      </ul>
    </section>

    <CinematicDetailModels :models :locale class="mt-24" />

    <section
      class="mt-24 flex flex-col items-center gap-5 rounded-3xl bg-transparency-white-t4 px-6 py-14 text-center ring-1 ring-transparency-white-t8"
    >
      <h2 class="text-2xl font-semibold text-primary-warm-white lg:text-4xl">
        {{ t('cinematic.detail.ctaTitle') }}
      </h2>
      <p class="max-w-xl text-primary-warm-gray lg:text-lg">
        {{ t('cinematic.detail.ctaBody') }}
      </p>
      <Button
        type="button"
        size="lg"
        :prepend-icon="Play"
        @click="emit('try')"
      >
        {{ t('cinematic.detail.try') }}
      </Button>
    </section>

    <div
      v-if="!heroTryVisible"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-transparency-white-t8 bg-primary-comfy-ink/95 p-3 backdrop-blur sm:hidden"
    >
      <Button
        type="button"
        :prepend-icon="Play"
        class="w-full"
        data-testid="cinematic-try-sticky"
        @click="emit('try')"
      >
        {{ t('cinematic.detail.try') }}
      </Button>
    </div>
  </div>
</template>
