<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { workshopApps } from '../../../lib/workshop/apps'
import type { AppWorkshopModel } from '../../../config/models-catalogue'
import type { Locale } from '../../../i18n/site'
import type { CinematicCopyKey } from '../../../lib/workshop/cinematic-studio/copy'
import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicAppCard from './CinematicAppCard.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly AppWorkshopModel[]
  locale?: Locale
}>()

const HUB_PROTOTYPE = 'https://comfy-website-preview-pr-17804.vercel.app/hub/'

const TAB_LABEL = {
  models: 'cinematic.hub.models',
  workflows: 'cinematic.hub.workflows',
  apps: 'cinematic.hub.apps'
} as const satisfies Record<string, CinematicCopyKey>
type Tab = keyof typeof TAB_LABEL
const TABS: readonly Tab[] = ['models', 'workflows', 'apps']
const tab = ref<Tab>('apps')

const apps = computed(() => workshopApps(locale, models))

const markerOffset = computed(
  () => `translateX(${TABS.indexOf(tab.value) * 100}%)`
)
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-7xl flex-col px-4 pt-8 pb-32 sm:px-8 lg:pt-12"
    data-testid="cinematic-apps-hub"
  >
    <header class="mb-8 flex flex-col gap-4">
      <p
        class="text-sm font-medium tracking-widest text-primary-comfy-yellow uppercase"
      >
        {{ tc('cinematic.hub.eyebrow', {}, { locale: locale }) }}
      </p>
      <h1 class="text-3xl font-light text-primary-comfy-canvas lg:text-5xl">
        {{ tc('cinematic.hub.heading', {}, { locale: locale }) }}
      </h1>
      <p class="max-w-2xl text-base text-content-secondary">
        {{ tc('cinematic.hub.subtitle', {}, { locale: locale }) }}
      </p>
    </header>

    <div
      class="relative mb-8 grid w-fit grid-cols-3 rounded-2xl bg-transparency-white-t8 p-1"
      role="group"
      :aria-label="tc('cinematic.hub.tabs', {}, { locale: locale })"
    >
      <div class="pointer-events-none absolute inset-1 grid grid-cols-3">
        <div
          class="rounded-xl bg-primary-warm-white transition-transform duration-300 ease-out motion-reduce:transition-none"
          :style="{ transform: markerOffset }"
        />
      </div>
      <button
        v-for="option in TABS"
        :key="option"
        type="button"
        :aria-pressed="tab === option"
        :class="
          cn(
            'relative inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-6 text-sm font-semibold whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:px-3',
            tab === option
              ? 'text-page'
              : 'text-content-secondary hover:text-content-bright'
          )
        "
        @click="tab = option"
      >
        {{ tc(TAB_LABEL[option], {}, { locale: locale }) }}
      </button>
    </div>

    <template v-if="tab === 'apps'">
      <p class="mb-6 text-sm text-content-secondary">
        {{ tc('cinematic.hub.appsIntro', {}, { locale: locale }) }}
      </p>
      <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CinematicAppCard
          v-for="app in apps"
          :key="app.key"
          :name="tc(app.name, {}, { locale: locale })"
          :summary="tc(app.summary, {}, { locale: locale })"
          :badge="tc(app.badge, {}, { locale: locale })"
          :meta="app.meta && tc(app.meta, {}, { locale: locale })"
          :image="app.image"
          :href="app.href"
        />
      </ul>
    </template>
    <div
      v-else
      class="flex flex-col items-start gap-3 rounded-3xl bg-hub-surface p-8"
    >
      <p class="text-base text-content-bright">
        {{ tc('cinematic.hub.elsewhere', {}, { locale: locale }) }}
      </p>
      <a
        :href="HUB_PROTOTYPE"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-primary-comfy-yellow underline underline-offset-4"
      >
        {{ tc('cinematic.hub.openHub', {}, { locale: locale }) }}
      </a>
    </div>
  </section>
</template>
