<script setup lang="ts">
import { computed } from 'vue'

import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import EditorPromptBox from '@/components/workshop/app-editor/EditorPromptBox.vue'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import SpriteSheetPickers from './SpriteSheetPickers.vue'
import EditorSeedField from '@/components/workshop/app-editor/EditorSeedField.vue'

const {
  sprite,
  inline = false,
  locale = 'en'
} = defineProps<{
  sprite: SpriteSheet
  /** Unfolds the style and motion grids in the panel, for phones. */
  inline?: boolean
  locale?: Locale
}>()

const { image, phase, setup } = sprite
const description = computed({
  get: () => setup.value.description,
  set: (next: string) => sprite.change({ description: next }, 'description')
})
const seed = computed({
  get: () => setup.value.seed,
  set: (next: number) => sprite.change({ seed: next }, 'seed')
})
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="flex min-w-0 flex-col gap-3 pt-2"
    data-testid="sprite-panel"
  >
    <EditorSourceTile
      kind="image"
      :src="image?.url"
      :caption="image?.name"
      :add-label="spc('sprite.empty.upload', locale)"
      :hint="spc('sprite.character.hint', locale)"
      :remove-label="spc('sprite.character.remove', locale)"
      input-test-id="sprite-character-file"
      @file="sprite.useFile"
      @remove="sprite.removeImage"
    />

    <EditorPromptBox
      v-model="description"
      :label="spc('sprite.animation', locale)"
      :placeholder="spc('sprite.animation.placeholder', locale)"
    />

    <SpriteSheetPickers :sprite :inline :locale />

    <EditorSeedField
      v-model="seed"
      :label="spc('sprite.seed', locale)"
      :shuffle-label="spc('sprite.seed.shuffle', locale)"
    />
  </fieldset>
</template>
