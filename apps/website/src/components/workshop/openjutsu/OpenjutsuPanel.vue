<script setup lang="ts">
import { ChevronDown, Maximize, Scissors } from '@lucide/vue'
import { computed } from 'vue'

import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'
import CinematicReferenceButton from '@/components/workshop/cinematic-studio/CinematicReferenceButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StudioImage } from '@/lib/workshop/cinematic-studio/take-image'
import type { SwapSize, SwapWindow } from '@/lib/workshop/openjutsu/clip'
import { SWAP_SIZES } from '@/lib/workshop/openjutsu/clip'
import OpenjutsuSeedField from './OpenjutsuSeedField.vue'

/** The panel's fields, in the order a run needs them, once a video is chosen. */
const {
  videoUrl,
  videoName,
  clipSeconds,
  range,
  partSeconds,
  characterUrl,
  characterName,
  locale = 'en'
} = defineProps<{
  videoUrl: string
  videoName?: string
  clipSeconds?: number
  range?: SwapWindow
  partSeconds?: number
  characterUrl?: string
  characterName?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  video: [file: File]
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

function pickedFile(image: StudioImage | undefined) {
  return image instanceof File ? image : undefined
}

const video = computed({
  get: (): StudioImage => ({ url: videoUrl, name: videoName ?? '' }),
  set: (image) => {
    const file = pickedFile(image)
    if (file) emit('video', file)
  }
})
const character = computed({
  get: (): StudioImage | undefined =>
    characterUrl ? { url: characterUrl, name: characterName ?? '' } : undefined,
  set: (image) => {
    const file = pickedFile(image)
    if (file) emit('character', file)
  }
})

const partSummary = computed(() =>
  clipSeconds === undefined || range === undefined || partSeconds === undefined
    ? undefined
    : t('openjutsu.trim.summary', {
        from: range.start.toFixed(1),
        to: (range.start + partSeconds).toFixed(1),
        total: clipSeconds.toFixed(1)
      })
)
</script>

<template>
  <div class="flex flex-col gap-3 pt-2">
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
        <div class="flex items-center gap-2 pb-2.5 pl-2.5">
          <CinematicReferenceButton
            v-model="video"
            kind="video"
            :removable="false"
            :locale
          />
          <CinematicReferenceButton
            v-model="character"
            kind="cast"
            :removable="false"
            :locale
          />
        </div>
      </div>
      <button
        v-if="partSummary"
        type="button"
        class="flex w-fit items-center gap-1.5 rounded-sm px-1 text-xs text-primary-warm-gray tabular-nums transition hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        data-testid="openjutsu-part"
        @click="emit('trim')"
      >
        <Scissors class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="sr-only">{{ t('openjutsu.trim.edit') }}:</span>
        {{ partSummary }}
      </button>
    </section>

    <div class="grid grid-cols-2 gap-2">
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
