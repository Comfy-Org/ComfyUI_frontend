<script setup lang="ts">
import { Play } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { CINEMATIC_STUDIO_APP_SLUG } from '@/lib/workshop/cinematic-studio/analytics'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import AppRepoLink from './AppRepoLink.vue'
import AppsBackLink from './AppsBackLink.vue'

const {
  models,
  cover,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  cover?: { url: string; poster?: string }
  locale?: Locale
}>()
const emit = defineEmits<{ try: [] }>()
const { t } = translationsFor(locale)

const EXAMPLES = [
  'portrait',
  'train',
  'desert',
  'neon-street',
  'red-coat',
  'diner'
] as const
const STEPS = [
  'cinematic.detail.step1',
  'cinematic.detail.step2',
  'cinematic.detail.step3'
] as const
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-4 py-8 sm:px-8 lg:px-14"
    data-testid="cinematic-detail"
  >
    <AppsBackLink :locale class="mb-5" />
    <section class="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <div class="flex flex-col items-start gap-5">
        <div class="flex flex-wrap items-center gap-3">
          <h1
            class="text-3xl font-semibold text-primary-warm-white lg:text-5xl"
          >
            {{ t('cinematic.title') }}
          </h1>
          <span
            class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ t('cinematic.beta') }}
          </span>
        </div>
        <p class="max-w-xl text-lg text-primary-warm-gray">
          {{ t('cinematic.lead') }}
        </p>
        <div class="flex w-full flex-wrap items-center gap-3 sm:w-auto">
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
      </div>
      <div
        class="aspect-video overflow-hidden rounded-3xl bg-transparency-white-t4 ring-1 ring-transparency-white-t8"
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

    <section class="mt-14">
      <h2 class="mb-5 text-xl font-semibold text-primary-warm-white">
        {{ t('cinematic.detail.howTitle') }}
      </h2>
      <ol class="grid gap-3 sm:grid-cols-3">
        <li
          v-for="(step, index) in STEPS"
          :key="step"
          class="flex gap-3 rounded-2xl bg-transparency-white-t4 p-4 text-primary-warm-white"
        >
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-comfy-yellow text-sm font-bold text-primary-comfy-ink"
          >
            {{ index + 1 }}
          </span>
          <span class="text-sm">{{ t(step) }}</span>
        </li>
      </ol>
    </section>

    <section class="mt-14">
      <h2 class="mb-5 text-xl font-semibold text-primary-warm-white">
        {{ t('cinematic.detail.examplesTitle') }}
      </h2>
      <ul class="grid grid-cols-2 gap-3 md:grid-cols-3">
        <li
          v-for="(name, index) in EXAMPLES"
          :key="name"
          class="aspect-video overflow-hidden rounded-2xl"
        >
          <img
            :src="`/images/cinematic-studio/${name}.jpg`"
            :alt="t('cinematic.detail.exampleAlt', { n: index + 1 })"
            class="size-full object-cover"
            loading="lazy"
          />
        </li>
      </ul>
    </section>

    <section class="mt-14 mb-6">
      <h2 class="mb-5 text-xl font-semibold text-primary-warm-white">
        {{ t('cinematic.detail.detailsTitle') }}
      </h2>
      <dl class="grid gap-6 sm:grid-cols-2">
        <div>
          <dt class="mb-2 text-sm text-primary-warm-gray">
            {{ t('cinematic.detail.runsOn') }}
          </dt>
          <dd class="flex flex-wrap gap-2">
            <span
              v-for="model in models"
              :key="model.slug"
              class="rounded-full bg-transparency-white-t8 px-3 py-1 text-sm text-primary-warm-white"
            >
              {{ model.name }}
            </span>
          </dd>
        </div>
        <div>
          <dt class="mb-2 text-sm text-primary-warm-gray">
            {{ t('cinematic.detail.openSource') }}
          </dt>
          <dd class="text-sm text-primary-warm-white">
            {{ t('cinematic.detail.openSourceBody') }}
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
