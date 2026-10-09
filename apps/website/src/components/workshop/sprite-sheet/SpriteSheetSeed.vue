<script setup lang="ts">
import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import EditorSeedField from '@/components/workshop/app-editor/EditorSeedField.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { setup } = sprite
</script>

<template>
  <EditorSeedField
    :model-value="setup.seed"
    :label="spc('sprite.seed', locale)"
    :shuffle-label="spc('sprite.seed.shuffle', locale)"
    @update:model-value="(seed) => sprite.change({ seed }, 'seed')"
  />
</template>
