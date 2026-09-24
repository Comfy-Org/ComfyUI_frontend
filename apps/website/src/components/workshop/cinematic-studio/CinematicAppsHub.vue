<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import type { CinematicCopyKey } from '../../../lib/workshop/cinematic-studio/copy'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const HUB_PROTOTYPE = 'https://comfy-website-preview-pr-17804.vercel.app/hub/'

const TAB_LABEL = {
  models: 'cinematic.hub.models',
  workflows: 'cinematic.hub.workflows',
  apps: 'cinematic.hub.apps'
} as const satisfies Record<string, CinematicCopyKey>
type Tab = keyof typeof TAB_LABEL
const TABS: readonly Tab[] = ['models', 'workflows', 'apps']
const tab = ref<Tab>('apps')

interface HubApp {
  readonly key: string
  readonly name: CinematicCopyKey
  readonly summary: CinematicCopyKey
  readonly badge: CinematicCopyKey
  readonly meta?: CinematicCopyKey
  readonly image?: string
  readonly href?: string
}

const apps = computed<readonly HubApp[]>(() => [
  {
    key: 'cinematic-studio',
    name: 'cinematic.title',
    summary: 'cinematic.hub.studioSummary',
    badge: 'cinematic.hub.beta',
    meta: 'cinematic.hub.studioMeta',
    image: '/images/cinematic-studio/neon-street.jpg',
    href: `${getRoutes(locale).cinematicStudio}?ux=e`
  },
  {
    key: 'image-to-3d',
    name: 'cinematic.hub.to3d',
    summary: 'cinematic.hub.to3dSummary',
    badge: 'cinematic.hub.soon'
  },
  {
    key: 'product-shots',
    name: 'cinematic.hub.product',
    summary: 'cinematic.hub.productSummary',
    badge: 'cinematic.hub.soon'
  },
  {
    key: 'storyboard',
    name: 'cinematic.hub.storyboard',
    summary: 'cinematic.hub.storyboardSummary',
    badge: 'cinematic.hub.soon'
  }
])

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
        {{ tc('cinematic.hub.eyebrow', locale) }}
      </p>
      <h1 class="text-3xl font-light text-primary-comfy-canvas lg:text-5xl">
        {{ tc('cinematic.hub.heading', locale) }}
      </h1>
      <p class="max-w-2xl text-base text-content-secondary">
        {{ tc('cinematic.hub.subtitle', locale) }}
      </p>
    </header>

    <div
      class="relative mb-8 grid w-fit grid-cols-3 rounded-2xl bg-transparency-white-t8 p-1"
      role="group"
      :aria-label="tc('cinematic.hub.tabs', locale)"
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
        {{ tc(TAB_LABEL[option], locale) }}
      </button>
    </div>

    <template v-if="tab === 'apps'">
      <p class="mb-6 text-sm text-content-secondary">
        {{ tc('cinematic.hub.appsIntro', locale) }}
      </p>
      <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li
          v-for="app in apps"
          :key="app.key"
          :class="
            cn(
              'group relative flex flex-col gap-3 rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200',
              app.href ? 'hover:bg-hub-surface-hover' : 'opacity-60'
            )
          "
        >
          <a
            v-if="app.href"
            :href="app.href"
            class="absolute inset-0 z-10 rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          >
            <span class="sr-only">{{ tc(app.name, locale) }}</span>
          </a>
          <div
            class="relative aspect-4/3 overflow-hidden rounded-3xl bg-hub-surface-hover"
          >
            <img
              v-if="app.image"
              :src="app.image"
              alt=""
              loading="lazy"
              class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span
              v-else
              class="grid size-full place-items-center font-formula text-7xl font-bold text-primary-warm-white/20 select-none"
              aria-hidden="true"
            >
              {{ tc(app.name, locale).charAt(0) }}
            </span>
            <span
              :class="
                cn(
                  'absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase',
                  app.href
                    ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                    : 'bg-primary-comfy-ink/70 text-primary-comfy-canvas'
                )
              "
            >
              {{ tc(app.badge, locale) }}
            </span>
          </div>
          <div class="flex flex-col gap-1.5 px-3">
            <h3 class="text-sm font-semibold text-content-bright">
              {{ tc(app.name, locale) }}
            </h3>
            <p class="line-clamp-2 text-xs/relaxed text-content-secondary">
              {{ tc(app.summary, locale) }}
            </p>
            <p v-if="app.meta" class="text-xs text-primary-warm-gray">
              {{ tc(app.meta, locale) }}
            </p>
          </div>
        </li>
      </ul>
    </template>
    <div
      v-else
      class="flex flex-col items-start gap-3 rounded-3xl bg-hub-surface p-8"
    >
      <p class="text-base text-content-bright">
        {{ tc('cinematic.hub.elsewhere', locale) }}
      </p>
      <a
        :href="HUB_PROTOTYPE"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-primary-comfy-yellow underline underline-offset-4"
      >
        {{ tc('cinematic.hub.openHub', locale) }}
      </a>
    </div>
  </section>
</template>
