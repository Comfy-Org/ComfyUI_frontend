<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { CreativeSettings } from '../../../lib/workshop/cinematic-studio/creative'
import { tcCreative } from '../../../lib/workshop/cinematic-studio/creative-copy'
import {
  GENRES,
  ERAS,
  TEMPOS
} from '../../../lib/workshop/cinematic-studio/creative'
const { locale, fieldClass, mode } = defineProps<{
  locale: Locale
  fieldClass: string
  mode: 'image' | 'video'
}>()
const filmChoices = [
  ...GENRES.filter((id) => id !== 'auto'),
  ...ERAS.filter((id) => id !== 'auto')
]
const rhythms: Readonly<Record<string, readonly number[]>> = {
  single: [100],
  calm: [47, 47],
  dynamic: [28, 19, 28, 19],
  chaotic: [7, 19, 9, 24, 6, 13, 10]
}
function chooseFilm(id: (typeof filmChoices)[number]) {
  const genre = GENRES.find((value) => value === id)
  const era = ERAS.find((value) => value === id)
  if (genre) draft.value.genre = genre
  if (era) draft.value.era = era
}
const draft = defineModel<CreativeSettings>({ required: true })
const t = (key: Parameters<typeof tcCreative>[0]) => tcCreative(key, locale)
</script>
<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <label class="flex flex-col gap-2 text-sm"
      >{{ t('genre')
      }}<select v-model="draft.genre" :class="fieldClass">
        <option v-for="value in GENRES" :key="value" :value>
          {{ t(value) }}
        </option>
      </select></label
    >
    <label class="flex flex-col gap-2 text-sm"
      >{{ t('era')
      }}<select v-model="draft.era" :class="fieldClass">
        <option v-for="value in ERAS" :key="value" :value>
          {{ t(value) }}
        </option>
      </select></label
    >
    <label v-if="mode === 'video'" class="flex flex-col gap-2 text-sm"
      >{{ t('tempo')
      }}<select v-model="draft.tempo" :class="fieldClass">
        <option v-for="value in TEMPOS" :key="value" :value>
          {{ t(value) }}
        </option>
      </select></label
    >
  </div>
  <details class="rounded-xl border border-transparency-white-t20 p-3">
    <summary class="cursor-pointer text-sm font-semibold">
      {{ t('visualExamples') }}
    </summary>
    <p class="my-3 text-xs text-primary-comfy-canvas">
      {{ t('illustrative') }}
    </p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <button
        v-for="(id, index) in filmChoices"
        :key="id"
        type="button"
        :aria-pressed="draft.genre === id || draft.era === id"
        class="overflow-hidden rounded-lg border border-transparency-white-t20 text-sm aria-pressed:border-primary-comfy-yellow"
        @click="chooseFilm(id)"
      >
        <span
          aria-hidden="true"
          class="block aspect-video bg-cover"
          :style="{
            backgroundImage: 'url(/images/cinematic-film-directions.png)',
            backgroundSize: '400% 400%',
            backgroundPosition: `${((index % 4) * 100) / 3}% ${(Math.floor(index / 4) * 100) / 3}%`
          }"
        />
        <span class="block p-2">{{ t(id) }}</span>
      </button>
    </div>
    <div v-if="mode === 'video'" class="mt-3 grid grid-cols-2 gap-2">
      <button
        v-for="id in TEMPOS.filter((value) => value !== 'auto')"
        :key="id"
        type="button"
        :aria-pressed="draft.tempo === id"
        class="rounded-lg border border-transparency-white-t20 p-3 text-sm aria-pressed:border-primary-comfy-yellow"
        @click="draft.tempo = id"
      >
        <span aria-hidden="true" class="mb-3 flex h-5 gap-1"
          ><span
            v-for="(width, index) in rhythms[id]"
            :key="index"
            class="rounded-sm bg-primary-comfy-yellow/70"
            :style="{ flex: width }"
        /></span>
        {{ t(id) }}
      </button>
    </div>
  </details>
</template>
