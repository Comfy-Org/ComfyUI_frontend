<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { computed } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import PaparazziSceneTile from './PaparazziSceneTile.vue'
import PaparazziUpload from './PaparazziUpload.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const emit = defineEmits<{ picked: [] }>()

const { setup, search, candidates, scene, ownScene } = paparazzi
const name = computed(() => setup.value.celebrity.trim())
const status = computed(() => {
  const current = search.value
  if (current.kind === 'searching')
    return pc('paparazzi.scene.searching', locale, { name: name.value })
  if (current.kind === 'failed') return pc('paparazzi.searchFailed', locale)
  if (current.kind === 'idle') return pc('paparazzi.scene.idle', locale)
  return current.candidates.length
    ? pc('paparazzi.scene.found', locale, {
        name: name.value,
        provider: current.provider
      })
    : pc('paparazzi.scene.empty', locale)
})
function pick(choose: () => unknown) {
  void choose()
  emit('picked')
}

const pickedToken = computed(() =>
  scene.value?.kind === 'found' ? scene.value.candidate.token : undefined
)
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="paparazzi-scenes">
    <p class="px-1 text-xs text-primary-warm-gray" aria-live="polite">
      {{ status }}
    </p>
    <div
      role="radiogroup"
      :aria-label="pc('paparazzi.scene', locale)"
      :aria-busy="search.kind === 'searching'"
      class="grid grid-cols-2 gap-x-4 gap-y-5"
    >
      <template v-if="search.kind === 'searching'">
        <span
          v-for="index in 4"
          :key="index"
          class="aspect-3/2 w-full rounded-xl bg-transparency-white-t4 motion-safe:animate-pulse"
          aria-hidden="true"
        />
      </template>
      <template v-else>
        <PaparazziSceneTile
          v-for="candidate in candidates"
          :key="candidate.token"
          :src="candidate.place.thumb"
          :label="pc(candidate.place.label, locale)"
          :checked="candidate.token === pickedToken"
          @pick="pick(() => paparazzi.pickScene(candidate.token))"
        />
      </template>
      <PaparazziSceneTile
        v-if="ownScene"
        :src="ownScene.url"
        :label="pc('paparazzi.scene.own', locale)"
        :checked="scene?.kind === 'own'"
        @pick="pick(paparazzi.pickOwnScene)"
      />
      <PaparazziUpload
        :label="pc('paparazzi.scene.upload', locale)"
        input-id="paparazzi-scene-input"
        class="group flex min-w-0 flex-col gap-1.5 text-left focus-visible:outline-none"
        @file="(file) => pick(() => paparazzi.useSceneFile(file))"
      >
        <span
          class="flex aspect-3/2 w-full items-center justify-center rounded-xl border border-dashed border-transparency-white-t20 text-primary-warm-gray transition group-hover:bg-transparency-white-t4 group-hover:text-primary-warm-white group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60"
        >
          <Upload class="size-5" aria-hidden="true" />
        </span>
        <span
          class="truncate px-1 text-sm text-primary-comfy-canvas group-hover:text-primary-warm-white"
          >{{ pc('paparazzi.scene.upload', locale) }}</span
        >
      </PaparazziUpload>
    </div>
    <p class="px-1 text-[11px] text-primary-warm-gray">
      {{ pc('paparazzi.scene.note', locale) }}
    </p>
  </div>
</template>
