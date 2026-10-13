<script setup lang="ts">
import { ChevronDown, Gauge } from '@lucide/vue'
import { computed } from 'vue'

import type { MoveImage, useMoveAnything } from '@/composables/useMoveAnything'
import type { Locale } from '@/i18n/translations'
import { mc } from '@/lib/workshop/move-anything/copy'
import EditorSeedField from '@/components/workshop/app-editor/EditorSeedField.vue'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'

const {
  image,
  move,
  locale = 'en'
} = defineProps<{
  image?: MoveImage
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { quality, seed, prompt, phase } = move

const qualities = [
  {
    id: 'fast',
    label: mc('move.quality.fast', locale),
    meta: mc('move.quality.fastHint', locale)
  },
  {
    id: 'best',
    label: mc('move.quality.best', locale),
    meta: mc('move.quality.bestHint', locale)
  }
] as const
const qualityValue = computed({
  get: () => quality.value,
  set: (id: string) => {
    const picked = qualities.find((option) => option.id === id)
    if (picked) quality.value = picked.id
  }
})
const qualityLabel = computed(
  () => qualities.find((option) => option.id === quality.value)?.label
)
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'moving' || phase.kind === 'done'"
    class="flex min-w-0 flex-col gap-3 pt-2"
    data-testid="move-panel"
  >
    <EditorSourceTile
      kind="image"
      :src="image?.url"
      :caption="image?.name"
      :add-label="mc('move.empty.upload', locale)"
      :hint="mc('move.photo.hint', locale)"
      :remove-label="mc('move.photo.remove', locale)"
      input-test-id="move-image-file"
      @file="move.useFile"
      @remove="move.removeImage"
    />

    <section>
      <label for="move-prompt" class="sr-only">
        {{ mc('move.prompt', locale) }}
      </label>
      <div
        class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
      >
        <textarea
          id="move-prompt"
          v-model="prompt"
          rows="4"
          :placeholder="mc('move.prompt.placeholder', locale)"
          class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        />
      </div>
    </section>

    <div class="grid grid-cols-2 gap-2">
      <CinematicMenu
        v-model="qualityValue"
        :options="qualities"
        :heading="mc('move.quality', locale)"
        side="top"
        tooltip
        :trigger-class="FORMAT_TRIGGER_CLASS"
      >
        <Gauge class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
        <span class="flex-1 text-left">{{ qualityLabel }}</span>
        <ChevronDown
          class="size-3.5 text-primary-warm-gray"
          aria-hidden="true"
        />
      </CinematicMenu>
      <EditorSeedField
        v-model="seed"
        :label="mc('move.seed', locale)"
        :shuffle-label="mc('move.seed.shuffle', locale)"
      />
    </div>
  </fieldset>
</template>
