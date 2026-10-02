<script setup lang="ts">
import { ChevronLeft, Columns2, RefreshCw } from '@lucide/vue'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { compare, source } = sprite
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
</template>
