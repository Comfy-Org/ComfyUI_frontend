<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import AppRepoLink from '../cinematic-studio/AppRepoLink.vue'

const {
  title,
  toolsLabel,
  repo,
  showDock = true,
  panelLabel,
  locale = 'en'
} = defineProps<{
  title: string
  toolsLabel: string
  repo?: string
  showDock?: boolean
  /** Names the side panel, shown when the `panel` slot is filled. */
  panelLabel?: string
  locale?: Locale
}>()
</script>

<template>
  <section
    :class="
      cn(
        'flex flex-col border-y border-transparency-white-t8 bg-primary-comfy-ink lg:h-[calc(100svh-7rem)] lg:overflow-hidden',
        $slots.panel
          ? 'max-lg:overflow-clip'
          : 'h-[calc(100svh-5rem)] min-h-150 overflow-hidden'
      )
    "
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
    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        :class="
          cn(
            'relative flex min-h-0 flex-1 flex-col bg-black/25',
            $slots.panel &&
              'max-lg:h-[min(60svh,calc(62vw+5.5rem))] max-lg:min-h-80 max-lg:flex-none'
          )
        "
      >
        <div
          :class="
            cn(
              'flex min-h-0 flex-1 items-start justify-center px-4 pt-14 pb-36 sm:px-8',
              $slots.panel && !showDock && 'pb-4 sm:pb-6'
            )
          "
        >
          <slot />
        </div>
        <slot name="overlay" />
        <div
          class="pointer-events-none absolute inset-x-3 top-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2"
        >
          <div class="pointer-events-auto justify-self-start">
            <slot name="start" />
          </div>
          <div class="pointer-events-auto">
            <slot name="center" />
          </div>
          <div class="pointer-events-auto justify-self-end">
            <slot name="end" />
          </div>
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
      <aside
        v-if="$slots.panel"
        :aria-label="panelLabel"
        class="flex min-h-0 flex-col border-transparency-white-t8 bg-primary-comfy-ink max-lg:border-t lg:w-85 lg:shrink-0 lg:border-l"
      >
        <div class="min-h-0 flex-1 lg:overflow-y-auto">
          <slot name="panel" />
        </div>
        <div
          v-if="$slots['panel-footer']"
          class="sticky bottom-0 border-t border-transparency-white-t8 bg-primary-comfy-ink p-3"
        >
          <slot name="panel-footer" />
        </div>
      </aside>
    </div>
  </section>
</template>
