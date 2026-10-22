<script setup lang="ts">
import { ChevronDown, Maximize } from '@lucide/vue'
import { computed } from 'vue'

import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapSize, SwapWindow } from '@/lib/workshop/openjutsu/clip'
import { SWAP_SIZES } from '@/lib/workshop/openjutsu/clip'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import OpenjutsuSeedField from './OpenjutsuSeedField.vue'
import OpenjutsuVideoSlot from './OpenjutsuVideoSlot.vue'

/** The panel's fields, in the order a run needs them; the video slot is always first. */
const {
  videoUrl,
  videoName,
  clipSeconds,
  range,
  trimmed = false,
  characterUrl,
  characterName,
  locale = 'en'
} = defineProps<{
  videoUrl?: string
  videoName?: string
  clipSeconds?: number
  range?: SwapWindow
  /** The video runs past the longest part, so only some of it is used. */
  trimmed?: boolean
  characterUrl?: string
  characterName?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  video: [file: File]
  removeVideo: []
  character: [file: File]
  trim: []
}>()

const target = defineModel<string>('target', { required: true })
const seed = defineModel<number | undefined>('seed')
const size = defineModel<SwapSize>('size', { required: true })

const sizes = SWAP_SIZES.map((id) => ({
  id,
  label: t(`openjutsu.size.${id}`)
}))
const sizeValue = computed({
  get: () => size.value,
  set: (id: string) => {
    const picked = SWAP_SIZES.find((option) => option === id)
    if (picked) size.value = picked
  }
})

const caption = computed(() =>
  clipSeconds === undefined
    ? videoName
    : `${videoName ?? ''} · ${Math.round(clipSeconds)} s`
)
const partNote = computed(() => {
  if (!trimmed || !range) return undefined
  return range.start < 0.05
    ? t('openjutsu.trim.first', { seconds: Math.round(range.seconds) })
    : t('openjutsu.trim.part', {
        from: range.start.toFixed(1),
        to: (range.start + range.seconds).toFixed(1)
      })
})
</script>

<template>
  <div class="flex flex-col gap-3 pt-2">
    <OpenjutsuVideoSlot
      :src="videoUrl"
      :caption
      :part-note="partNote"
      :locale
      @file="emit('video', $event)"
      @remove="emit('removeVideo')"
      @trim="emit('trim')"
    />

    <EditorSourceTile
      kind="image"
      :src="characterUrl"
      :name="characterName"
      :add-label="t('openjutsu.needs.character')"
      :change-label="t('reshoot.clip.change')"
      input-test-id="openjutsu-character-file"
      @file="emit('character', $event)"
    />

    <section class="flex flex-col gap-2">
      <label for="openjutsu-target" class="sr-only">
        {{ t('openjutsu.target.heading') }}
      </label>
      <div
        class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
      >
        <textarea
          id="openjutsu-target"
          v-model="target"
          rows="4"
          :placeholder="t('openjutsu.target.placeholder')"
          class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        />
      </div>
    </section>

    <div class="flex flex-col gap-2">
      <CinematicMenu
        v-model="sizeValue"
        :options="sizes"
        :heading="t('openjutsu.size.label')"
        side="top"
        tooltip
        :trigger-class="FORMAT_TRIGGER_CLASS"
      >
        <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
        <span class="flex-1 text-left">{{ size }}</span>
        <ChevronDown
          class="size-3.5 text-primary-warm-gray"
          aria-hidden="true"
        />
      </CinematicMenu>
      <OpenjutsuSeedField
        v-model="seed"
        :label="t('reshoot.seed.label')"
        :random-label="t('openjutsu.seed.placeholder')"
        :shuffle-label="t('openjutsu.seed.shuffle')"
      />
    </div>
  </div>
</template>
