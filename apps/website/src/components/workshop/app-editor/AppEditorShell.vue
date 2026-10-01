<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import { useSlots } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import AppRepoLink from '../cinematic-studio/AppRepoLink.vue'
import EditorDock from './EditorDock.vue'
import EditorFloatingPanel from './EditorFloatingPanel.vue'

const {
  title,
  toolsLabel,
  repo,
  showDock = true,
  panelLabels,
  panelDimmed = false,
  locale = 'en'
} = defineProps<{
  title: string
  toolsLabel: string
  repo?: string
  showDock?: boolean
  /** Names the floating panel shown when the `panel` slot is filled. */
  panelLabels?: { label: string; expand: string; collapse: string }
  panelDimmed?: boolean
  locale?: Locale
}>()

const slots = useSlots()
const wide = useMediaQuery('(min-width: 1024px)')
const floating = () => Boolean(slots.panel && panelLabels)
const dockOverSheet = () => floating() && !wide.value && !panelDimmed
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
    <div
      class="relative flex min-h-0 flex-1 flex-col bg-black/30 bg-[radial-gradient(var(--color-transparency-white-t8)_1px,transparent_1px)] bg-size-[18px_18px]"
    >
      <div
        :class="
          cn(
            'flex min-h-0 flex-1 items-start justify-center px-4 pt-14 pb-36 sm:px-8',
            floating() && 'pt-16 pb-60 lg:pr-6 lg:pb-20 lg:pl-86',
            floating() && panelDimmed && 'pb-24'
          )
        "
      >
        <slot />
      </div>
      <slot name="overlay" />
      <div
        :class="
          cn(
            'pointer-events-none absolute inset-x-3 top-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2',
            floating() && 'lg:left-86'
          )
        "
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
        :class="
          cn(
            'pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 px-3',
            floating() && 'lg:left-83'
          )
        "
      >
        <slot name="tray" />
        <EditorDock v-if="showDock && !dockOverSheet()" :label="toolsLabel">
          <slot name="dock" />
        </EditorDock>
      </div>
      <EditorFloatingPanel
        v-if="floating() && panelLabels"
        :label="panelLabels.label"
        :labels="panelLabels"
        :dimmed="panelDimmed"
      >
        <template v-if="showDock && dockOverSheet()" #above>
          <EditorDock :label="toolsLabel">
            <slot name="dock" />
          </EditorDock>
        </template>
        <slot name="panel" />
        <template v-if="$slots['panel-peek']" #peek>
          <slot name="panel-peek" />
        </template>
        <template v-if="$slots['panel-footer']" #footer>
          <slot name="panel-footer" />
        </template>
      </EditorFloatingPanel>
    </div>
  </section>
</template>
