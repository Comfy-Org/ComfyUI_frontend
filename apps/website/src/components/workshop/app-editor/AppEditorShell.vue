<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import { useSlots } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
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
    class="flex h-svh min-h-150 flex-col overflow-hidden bg-primary-comfy-ink"
    :aria-label="title"
  >
    <div
      class="relative flex min-h-0 flex-1 flex-col bg-black/30 bg-[radial-gradient(var(--color-transparency-white-t4)_1px,transparent_1px)] bg-size-[24px_24px]"
    >
      <div
        :class="
          cn(
            'flex min-h-0 flex-1 items-start justify-center px-4 pt-16 pb-36 sm:px-8',
            floating() && 'pb-52 lg:pr-6 lg:pb-20 lg:pl-86',
            floating() && panelDimmed && 'pb-24'
          )
        "
      >
        <slot />
      </div>
      <header
        class="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center gap-2"
      >
        <div class="pointer-events-auto flex h-9 min-w-0 items-center gap-1">
          <a
            :href="getRoutes(locale).home"
            :aria-label="t('nav.home', locale)"
            data-testid="apps-home"
            class="flex size-9 shrink-0 items-center justify-center rounded-full transition hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          >
            <img src="/icons/logomark.svg" alt="" class="h-4 w-auto" />
          </a>
          <span class="h-4 w-px bg-transparency-white-t20" aria-hidden="true" />
          <a
            :href="getRoutes(locale).hubApps"
            :aria-label="tc('cinematic.backToApps', locale)"
            data-testid="apps-back"
            class="flex size-9 shrink-0 items-center justify-center rounded-full text-primary-warm-gray transition hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
          </a>
          <h1 class="truncate pr-1 text-sm font-medium text-primary-warm-white">
            {{ title }}
          </h1>
          <span
            class="shrink-0 rounded-full border border-transparency-white-t20 px-1.5 font-mono text-[9px] tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ tc('cinematic.beta', locale) }}
          </span>
        </div>
        <span class="flex-1" />
        <div class="pointer-events-auto flex items-center gap-2">
          <AppRepoLink :repo :locale class="max-lg:hidden" />
        </div>
      </header>
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
