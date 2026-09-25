<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  ReshootAspect,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  RESHOOT_ASPECTS,
  RESHOOT_SIZES
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import CinematicMenu from '../CinematicMenu.vue'

const {
  clip,
  clipName,
  isExample,
  locale = 'en'
} = defineProps<{
  clip: string
  clipName: string
  isExample: boolean
  locale?: Locale
}>()

const upload = defineModel<File | undefined>('upload')
const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })

const aspectLabel = (id: ReshootAspect) =>
  id === 'source' ? rc('reshoot.aspect.source', locale) : id
const aspectOptions = computed(() =>
  RESHOOT_ASPECTS.map((id) => ({ id, label: aspectLabel(id) }))
)
const aspectValue = computed({
  get: () => aspect.value,
  set: (id: string) => {
    const match = RESHOOT_ASPECTS.find((option) => option === id)
    if (match) aspect.value = match
  }
})

function choose(event: Event) {
  const input = event.target
  if (input instanceof HTMLInputElement && input.files?.[0])
    upload.value = input.files[0]
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      class="flex items-center gap-3 rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 p-2.5"
    >
      <video
        :src="clip"
        muted
        playsinline
        preload="metadata"
        class="aspect-video w-20 shrink-0 rounded-lg bg-primary-comfy-ink object-cover"
      />
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="truncate text-sm font-semibold text-primary-warm-white">
          {{ clipName }}
        </span>
        <span
          v-if="isExample"
          class="w-fit rounded-md bg-transparency-white-t8 px-1.5 py-0.5 text-[11px] text-primary-comfy-canvas"
        >
          {{ rc('reshoot.clip.example', locale) }}
        </span>
      </span>
      <label
        class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white"
        :title="rc('reshoot.clip.replace', locale)"
      >
        <Upload class="size-4" aria-hidden="true" />
        <span class="sr-only">{{ rc('reshoot.clip.replace', locale) }}</span>
        <input type="file" accept="video/*" class="sr-only" @change="choose" />
      </label>
    </div>
    <p class="text-xs/relaxed text-primary-warm-gray">
      {{ rc('reshoot.clip.help', locale) }}
    </p>
    <div class="grid grid-cols-2 gap-2">
      <CinematicMenu
        v-model="aspectValue"
        :options="aspectOptions"
        :heading="rc('reshoot.aspect', locale)"
        trigger-class="h-10 justify-center border border-transparency-white-t20 text-sm text-primary-warm-white hover:border-primary-warm-white/50"
      >
        {{ aspectLabel(aspect) }}
      </CinematicMenu>
      <div
        class="grid grid-cols-2 rounded-xl border border-transparency-white-t20 p-0.5"
        role="radiogroup"
        :aria-label="rc('reshoot.size', locale)"
      >
        <button
          v-for="option in RESHOOT_SIZES"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="size === option"
          :title="rc(`reshoot.size.${option}`, locale)"
          :class="
            cn(
              'rounded-lg text-sm transition-colors',
              size === option
                ? 'bg-primary-warm-white text-page'
                : 'text-primary-comfy-canvas hover:text-primary-warm-white'
            )
          "
          @click="size = option"
        >
          {{ option }}
        </button>
      </div>
    </div>
  </div>
</template>
