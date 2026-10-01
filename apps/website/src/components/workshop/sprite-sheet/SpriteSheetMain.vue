<script setup lang="ts">
import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import { SPRITE_EXAMPLE } from '../../../lib/workshop/sprite-sheet/mock-run'
import EditorEmpty from '../app-editor/EditorEmpty.vue'
import SpriteSheetWorkspace from './SpriteSheetWorkspace.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { image } = sprite
</script>

<template>
  <EditorEmpty
    v-if="!image"
    :title="spc('sprite.empty.title', locale)"
    :meta="spc('sprite.empty.meta', locale)"
    :upload-label="spc('sprite.empty.upload', locale)"
    :example-label="spc('sprite.empty.example', locale)"
    :example-image="SPRITE_EXAMPLE.url"
    data-testid="sprite-empty"
    @file="sprite.useFile"
    @example="sprite.useExample"
  />
  <SpriteSheetWorkspace v-else :sprite :locale />
</template>
