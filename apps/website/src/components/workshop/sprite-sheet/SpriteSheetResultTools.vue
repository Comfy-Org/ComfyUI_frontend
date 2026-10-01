<script setup lang="ts">
import { ChevronLeft, Columns2, Download, RefreshCw } from '@lucide/vue'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import type { SpriteSheetResult } from '../../../lib/workshop/sprite-sheet/mock-run'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const {
  sprite,
  result,
  locale = 'en'
} = defineProps<{
  sprite: SpriteSheet
  result: SpriteSheetResult
  locale?: Locale
}>()

const { image, compare, source, setup } = sprite
const fileName = () =>
  `${(image.value?.name ?? 'sprite').replace(/\.\w+$/, '')}-${setup.value.motion}-sheet.png`
</script>

<template>
  <EditorTool
    :icon="Columns2"
    :label="spc('sprite.compare', locale)"
    :pressed="compare"
    :disabled="!source"
    @click="compare = !compare"
  />
  <EditorDivider class="max-sm:hidden" />
  <EditorTool
    :icon="ChevronLeft"
    :label="spc('sprite.edit', locale)"
    @click="sprite.edit"
  />
  <EditorTool
    :icon="RefreshCw"
    :label="spc('sprite.again', locale)"
    @click="sprite.again"
  />
  <EditorDivider class="max-sm:hidden" />
  <a
    :href="result.url"
    :download="fileName()"
    class="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary-comfy-yellow px-3.5 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
  >
    <Download class="size-3.5" aria-hidden="true" />
    {{ spc('sprite.download', locale) }}
  </a>
</template>
