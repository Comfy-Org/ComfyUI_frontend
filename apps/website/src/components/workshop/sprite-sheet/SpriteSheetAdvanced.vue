<script setup lang="ts">
import { GalleryHorizontal } from '@lucide/vue'
import { computed } from 'vue'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import { FRAME_COUNTS } from '../../../lib/workshop/sprite-sheet/options'
import EditorOutput from '../app-editor/EditorOutput.vue'
import EditorSeedField from '../app-editor/EditorSeedField.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { setup } = sprite
const counts = FRAME_COUNTS.map((count) => ({
  id: String(count),
  label: spc('sprite.frames.value', locale, { n: count })
}))
const frames = computed({
  get: () => String(setup.value.frames),
  set: (next: string) => {
    const count = FRAME_COUNTS.find((known) => String(known) === next)
    if (count) sprite.change({ frames: count })
  }
})
const seed = computed({
  get: () => setup.value.seed,
  set: (next: number) => sprite.change({ seed: next }, 'seed')
})
</script>

<template>
  <EditorOutput
    v-model="frames"
    :heading="spc('sprite.frames', locale)"
    :options="counts"
    :icon="GalleryHorizontal"
    :label="spc('sprite.frames', locale)"
  />
  <EditorSeedField
    v-model="seed"
    :label="spc('sprite.seed', locale)"
    :shuffle-label="spc('sprite.seed.shuffle', locale)"
  />
</template>
