<script setup lang="ts">
import { ChevronDown, Dices, Gauge } from '@lucide/vue'
import { computed, useId } from 'vue'

import type { MoveImage, useMoveAnything } from '@/composables/useMoveAnything'
import type { Locale } from '@/i18n/translations'
import { mc } from '@/lib/workshop/move-anything/copy'
import EditorIconButton from '@/components/workshop/app-editor/EditorIconButton.vue'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'

const {
  image,
  move,
  locale = 'en'
} = defineProps<{
  image: MoveImage
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { quality, seed, prompt, phase } = move
const seedId = useId()

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

function onSeed(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Math.round(Number(event.target.value))
  if (Number.isFinite(value) && value >= 0) seed.value = value
}

function shuffleSeed() {
  seed.value = Math.floor(Math.random() * 1_000_000_000)
}
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'moving' || phase.kind === 'done'"
    class="flex min-w-0 flex-col gap-3 pt-2"
    data-testid="move-panel"
  >
    <EditorSourceTile
      kind="image"
      :src="image.url"
      :name="image.name"
      :add-label="mc('move.empty.upload', locale)"
      :change-label="mc('move.change', locale)"
      input-test-id="move-image-file"
      @file="move.useFile"
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
      <div
        class="flex h-10 items-center gap-1 rounded-xl border border-transparency-white-t8 pr-1 pl-3 hover:border-transparency-white-t20"
      >
        <label :for="seedId" class="sr-only">{{
          mc('move.seed', locale)
        }}</label>
        <input
          :id="seedId"
          :value="seed"
          type="number"
          min="0"
          step="1"
          class="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-primary-warm-white tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50"
          @change="onSeed"
        />
        <EditorIconButton
          :icon="Dices"
          :label="mc('move.seed.shuffle', locale)"
          @click="shuffleSeed"
        />
      </div>
    </div>
  </fieldset>
</template>
