<script setup lang="ts">
import { ArrowRight, Play } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import WorkshopAppCard from '@/components/workshop/WorkshopAppCard.vue'
import type { AppWorkshopModel } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { ac } from '@/lib/workshop/catalogue-apps'
import { CINEMATIC_STUDIO_APP_SLUG } from '@/lib/workshop/cinematic-studio/analytics'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import { STARTER_SHOTS } from '@/lib/workshop/cinematic-studio/starters'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import AppRepoLink from './AppRepoLink.vue'
import AppsBackLink from './AppsBackLink.vue'

const {
  app,
  apps,
  models,
  locale = 'en'
} = defineProps<{
  app: AppWorkshopModel
  apps: readonly AppWorkshopModel[]
  models: readonly CinematicModel[]
  locale?: Locale
}>()
const emit = defineEmits<{ try: [starter?: string] }>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)

const useCase = app.useCases[0]
const moreApps = apps
  .filter((other) => other.slug !== app.slug)
  .map((other) => ({
    key: other.slug,
    name: other.name,
    task: other.summary ?? '',
    href: other.href,
    thumbnail: other.thumbnail
  }))
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-6 py-10 lg:px-8 lg:py-14"
    data-testid="cinematic-detail"
  >
    <AppsBackLink :locale class="mb-8" />
    <header
      class="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="flex max-w-2xl flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <a
            v-if="useCase"
            :href="routes.hubApps"
            class="inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow"
          >
            {{ t(useCaseLabelKey[useCase]) }}
          </a>
          <span
            class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ t('cinematic.beta') }}
          </span>
        </div>
        <h1 class="text-3xl font-bold text-primary-comfy-canvas lg:text-4xl">
          {{ app.name }}
        </h1>
        <p class="text-sm/relaxed text-primary-warm-gray">
          {{ t('cinematic.lead') }}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            :prepend-icon="Play"
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
      <p class="text-sm text-primary-warm-gray">
        {{ t('cinematic.detail.modelCount', { count: models.length }) }}
      </p>
    </header>

    <div
      class="aspect-video overflow-hidden rounded-2xl bg-transparency-white-t4 ring-1 ring-transparency-white-t8 lg:aspect-21/9"
    >
      <video
        v-if="app.thumbnail?.kind === 'video'"
        :src="app.thumbnail.url"
        :poster="app.thumbnail.poster"
        class="size-full object-cover"
        autoplay
        muted
        loop
        playsinline
        aria-hidden="true"
      />
    </div>

    <section class="mt-10" aria-labelledby="cinematic-examples">
      <h2
        id="cinematic-examples"
        class="mb-5 text-sm font-bold text-primary-warm-white"
      >
        {{ t('workshop.examples.start') }}
      </h2>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="shot in STARTER_SHOTS"
          :key="shot.id"
          type="button"
          class="cursor-pointer overflow-hidden rounded-2xl text-left ring-1 ring-transparency-white-t8 transition-all hover:ring-transparency-white-t20 hover:brightness-110 focus-visible:outline-primary-comfy-yellow"
          data-testid="cinematic-example"
          @click="emit('try', shot.id)"
        >
          <img :src="shot.image" alt="" class="aspect-video w-full object-cover" />
          <span class="block p-4 text-sm text-primary-warm-gray">
            {{ t(shot.label) }}
          </span>
        </button>
      </div>
    </section>

    <section
      v-if="moreApps.length"
      class="mt-24 border-t border-transparency-white-t8 pt-12"
      data-testid="related-apps"
    >
      <div class="mb-6 flex items-baseline justify-between gap-4">
        <h2 class="text-2xl font-bold text-primary-comfy-canvas">
          {{ t('cinematic.detail.moreApps') }}
        </h2>
        <a
          :href="routes.hubApps"
          class="inline-flex items-center gap-2 text-sm font-bold tracking-wider text-primary-comfy-yellow uppercase hover:underline"
        >
          {{ ac('browseAllApps', locale) }}
          <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
        </a>
      </div>
      <ul
        class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <li v-for="other in moreApps" :key="other.key">
          <WorkshopAppCard :app="other" />
        </li>
      </ul>
    </section>
  </div>
</template>
