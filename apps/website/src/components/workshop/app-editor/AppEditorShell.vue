<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { ChevronLeft } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import { computed, provide, useSlots, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { EDITOR_ZOOM, useEditorZoom } from '@/composables/useEditorZoom'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import AppRepoLink from '@/components/workshop/cinematic-studio/AppRepoLink.vue'
import WorkshopAccount from '@/components/workshop/WorkshopAccount.vue'
import EditorDock from './EditorDock.vue'
import EditorDownload from './EditorDownload.vue'
import EditorFloatingPanel from './EditorFloatingPanel.vue'
import EditorZoom from './EditorZoom.vue'

const {
  title,
  toolsLabel,
  repo,
  showDock = true,
  panelLabels,
  panelDimmed = false,
  download,
  back,
  locale = 'en'
} = defineProps<{
  title: string
  toolsLabel: string
  repo?: string
  showDock?: boolean
  /** Names the floating panel shown when the `panel` slot is filled. */
  panelLabels?: { label: string; expand: string; collapse: string }
  panelDimmed?: boolean
  /** The result to download from the header, once there is one. */
  download?: { href: string; name: string }
  /** Where the back arrow leads instead of the Hub's Apps tab. */
  back?: { href: string; label: string }
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const backLink = computed(
  () =>
    back ?? {
      href: getRoutes(locale).hubApps,
      label: t('cinematic.backToApps')
    }
)

const slots = useSlots()
const wide = useMediaQuery('(min-width: 768px)')
const floating = () => Boolean(slots.panel && panelLabels)
const dockOverSheet = () => floating() && !wide.value && !panelDimmed
const zoom = useEditorZoom(useTemplateRef<HTMLElement>('canvas'))
provide(EDITOR_ZOOM, zoom)
const { frame } = zoom
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
        ref="canvas"
        :class="
          cn(
            'flex min-h-0 flex-1 touch-none items-start justify-center px-4 pt-16 pb-36 sm:px-8',
            floating() &&
              'pb-52 md:pr-6 md:pb-20 md:pl-[calc(var(--container-editor-panel)+1.5rem)]',
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
            :href="backLink.href"
            :aria-label="backLink.label"
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
            {{ t('cinematic.beta') }}
          </span>
        </div>
        <span class="flex-1" />
        <div class="pointer-events-auto flex items-center gap-2">
          <AppRepoLink :repo :locale class="max-md:hidden" />
          <EditorDownload :file="download" :locale />
          <WorkshopAccount :locale />
        </div>
      </header>
      <div
        :class="
          cn(
            'pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 px-3 lg:pr-44',
            floating() &&
              'md:left-[calc(var(--container-editor-panel)+0.75rem)]'
          )
        "
      >
        <slot name="tray" />
        <EditorDock v-if="showDock && !dockOverSheet()" :label="toolsLabel">
          <slot name="dock" />
          <template #history>
            <slot name="history" />
          </template>
        </EditorDock>
      </div>
      <EditorZoom
        v-if="frame"
        :zoom
        :locale
        class="absolute right-16 bottom-4 max-lg:hidden"
      />
      <EditorFloatingPanel
        v-if="floating() && panelLabels"
        :label="panelLabels.label"
        :labels="panelLabels"
        :dimmed="panelDimmed"
      >
        <template v-if="showDock && dockOverSheet()" #above>
          <EditorDock :label="toolsLabel">
            <slot name="dock" />
            <template #history>
              <slot name="history" />
            </template>
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
