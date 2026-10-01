<script setup lang="ts">
import { computed } from 'vue'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import { FRAME_COUNTS } from '../../../lib/workshop/sprite-sheet/options'
import EditorNumberField from '../app-editor/EditorNumberField.vue'
import EditorSegmented from '../app-editor/EditorSegmented.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { setup } = sprite
const counts = FRAME_COUNTS.map((count) => ({
  id: String(count),
  label: String(count)
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
  <EditorSegmented
    v-model="frames"
    :label="spc('sprite.frames', locale)"
    :options="counts"
  />
  <EditorNumberField v-model="seed" :label="spc('sprite.seed', locale)" />
</template>
