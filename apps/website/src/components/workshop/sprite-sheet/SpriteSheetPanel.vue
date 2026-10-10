<script setup lang="ts">
import { computed, useId } from 'vue'

import type { SpriteSheet } from '@/composables/useSpriteSheet'
import type { Locale } from '@/i18n/translations'
import { spc } from '@/lib/workshop/sprite-sheet/copy'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import SpriteSheetPickers from './SpriteSheetPickers.vue'
import SpriteSheetSeedField from './SpriteSheetSeedField.vue'

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
const promptId = useId()
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
      v-if="image"
      kind="image"
      :src="image.url"
      :name="image.name"
      :add-label="spc('sprite.empty.upload', locale)"
      :change-label="spc('sprite.character.changeLabel', locale)"
      input-test-id="sprite-character-file"
      @file="sprite.useFile"
    />

    <section>
      <label :for="promptId" class="sr-only">
        {{ spc('sprite.animation', locale) }}
      </label>
      <div
        class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
      >
        <textarea
          :id="promptId"
          v-model="description"
          rows="4"
          :placeholder="spc('sprite.animation.placeholder', locale)"
          class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        />
      </div>
    </section>

    <SpriteSheetPickers :sprite :inline :locale />

    <SpriteSheetSeedField
      v-model="seed"
      :label="spc('sprite.seed', locale)"
      :shuffle-label="spc('sprite.seed.shuffle', locale)"
    />
  </fieldset>
</template>
