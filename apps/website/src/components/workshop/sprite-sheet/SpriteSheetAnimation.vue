<script setup lang="ts">
import { computed } from 'vue'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorTextArea from '../app-editor/EditorTextArea.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { setup } = sprite
const description = computed({
  get: () => setup.value.description,
  set: (next: string) => sprite.change({ description: next }, 'description')
})
</script>

<template>
  <EditorTextArea
    v-model="description"
    :label="spc('sprite.animation', locale)"
    :placeholder="spc('sprite.animation.placeholder', locale)"
  />
</template>
