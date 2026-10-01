<script setup lang="ts">
import { Layers, Pause, Play } from '@lucide/vue'

import type { SpritePlayback } from '../../../composables/useSpritePlayback'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorTool from '../app-editor/EditorTool.vue'

const { playback, locale = 'en' } = defineProps<{
  playback: SpritePlayback
  locale?: Locale
}>()

const { playing, fps, onion } = playback
</script>

<template>
  <EditorTool
    :icon="playing ? Pause : Play"
    :label="spc(playing ? 'sprite.pause' : 'sprite.play', locale)"
    icon-only
    data-testid="sprite-play"
    @click="playback.toggle"
  />
  <button
    type="button"
    :aria-label="spc('sprite.fps.label', locale, { n: fps })"
    :title="spc('sprite.fps.label', locale, { n: fps })"
    class="flex h-8 shrink-0 items-center rounded-full px-2 text-xs text-primary-warm-gray tabular-nums transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
    @click="playback.nextRate"
  >
    {{ spc('sprite.fps', locale, { n: fps }) }}
  </button>
  <EditorTool
    :icon="Layers"
    :label="spc('sprite.onion', locale)"
    icon-only
    :pressed="onion"
    @click="onion = !onion"
  />
</template>
