<script setup lang="ts">
import { ZoomIn, ZoomOut } from '@lucide/vue'

import type { EditorZoom } from '../../../composables/useEditorZoom'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import EditorTool from './EditorTool.vue'
import { MAX_ZOOM, MIN_ZOOM } from './zoom'

const { zoom, locale = 'en' } = defineProps<{
  zoom: EditorZoom
  locale?: Locale
}>()

const { view, percent } = zoom
</script>

<template>
  <div
    role="group"
    :aria-label="tc('cinematic.zoom', locale)"
    class="pointer-events-auto flex items-center gap-0.5 rounded-full border border-transparency-white-t20 bg-primary-comfy-ink-light p-1 shadow-xl shadow-black/40"
  >
    <EditorTool
      :icon="ZoomOut"
      :label="tc('cinematic.zoom.out', locale)"
      icon-only
      :disabled="view.scale <= MIN_ZOOM"
      @click="zoom.zoomOut"
    />
    <button
      type="button"
      :aria-label="tc('cinematic.zoom.fit', locale, { n: percent })"
      class="h-8 min-w-12 rounded-full px-1.5 text-xs text-primary-warm-gray tabular-nums transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      data-testid="editor-zoom-fit"
      @click="zoom.fit"
    >
      {{ percent }}%
    </button>
    <EditorTool
      :icon="ZoomIn"
      :label="tc('cinematic.zoom.in', locale)"
      icon-only
      :disabled="view.scale >= MAX_ZOOM"
      @click="zoom.zoomIn"
    />
  </div>
</template>
