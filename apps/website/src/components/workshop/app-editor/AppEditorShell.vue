<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'

import { getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import AppRepoLink from '../cinematic-studio/AppRepoLink.vue'

const {
  title,
  toolsLabel,
  repo,
  showDock = true,
  locale = 'en'
} = defineProps<{
  title: string
  toolsLabel: string
  repo?: string
  showDock?: boolean
  locale?: Locale
}>()
</script>

<template>
  <section
    class="flex h-[calc(100svh-5rem)] min-h-150 flex-col overflow-hidden border-y border-transparency-white-t8 bg-primary-comfy-ink lg:h-[calc(100svh-7rem)]"
    :aria-label="title"
  >
    <header
      class="flex h-13 shrink-0 items-center gap-2.5 border-b border-transparency-white-t8 pr-3 pl-2 sm:pr-4"
    >
      <a
        :href="getRoutes(locale).hubApps"
        :aria-label="tc('cinematic.backToApps', locale)"
        data-testid="apps-back"
        class="flex size-9 items-center justify-center rounded-lg text-primary-warm-gray transition hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
      </a>
      <span class="h-4.5 w-px bg-transparency-white-t20" aria-hidden="true" />
      <h1 class="truncate text-sm font-medium text-primary-warm-white">
        {{ title }}
      </h1>
      <span
        class="rounded-full border border-transparency-white-t20 px-1.5 font-mono text-[9px] tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ tc('cinematic.beta', locale) }}
      </span>
      <span class="flex-1" />
      <AppRepoLink :repo :locale class="max-sm:hidden" />
    </header>
    <div class="relative flex min-h-0 flex-1 flex-col bg-black/25">
      <div
        class="flex min-h-0 flex-1 items-start justify-center px-4 pt-14 pb-36 sm:px-8"
      >
        <slot />
      </div>
      <slot name="overlay" />
      <div
        class="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 *:pointer-events-auto"
      >
        <slot name="start" />
        <slot name="end" />
      </div>
      <div
        class="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 px-3"
      >
        <slot name="tray" />
        <div
          v-if="showDock"
          role="toolbar"
          :aria-label="toolsLabel"
          class="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-3xl border border-transparency-white-t20 bg-primary-comfy-ink-light p-1 shadow-xl shadow-black/40 sm:flex-nowrap sm:rounded-full"
        >
          <slot name="dock" />
        </div>
      </div>
    </div>
  </section>
</template>
