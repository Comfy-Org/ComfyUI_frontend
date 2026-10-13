<script setup lang="ts">
import { ChevronLeft, RefreshCw } from '@lucide/vue'

import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import EditorTool from '@/components/workshop/app-editor/EditorTool.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()
</script>

<template>
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
