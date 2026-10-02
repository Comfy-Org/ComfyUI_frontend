<script setup lang="ts">
import { computed } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorTiles from '../app-editor/EditorTiles.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const emit = defineEmits<{ picked: [] }>()

const OWN = 'own'
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
const options = computed(() => [
  ...candidates.value.map((candidate) => ({
    id: candidate.token,
    label: pc(candidate.place.label, locale),
    src: candidate.place.thumb
  })),
  ...(ownScene.value
    ? [
        {
          id: OWN,
          label: pc('paparazzi.scene.own', locale),
          src: ownScene.value.url
        }
      ]
    : [])
])
const picked = computed(() => {
  const current = scene.value
  if (current?.kind === 'own') return OWN
  return current?.candidate.token
})

function pick(id: string) {
  if (id === OWN) paparazzi.pickOwnScene()
  else paparazzi.pickScene(id)
  emit('picked')
}

function upload(file: File) {
  void paparazzi.useSceneFile(file)
  emit('picked')
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="paparazzi-scenes">
    <p class="px-1 text-xs text-primary-warm-gray" aria-live="polite">
      {{ status }}
    </p>
    <EditorTiles
      :model-value="picked"
      :label="pc('paparazzi.scene', locale)"
      :options
      :columns="2"
      aspect="photo"
      :busy="search.kind === 'searching'"
      :upload="{
        label: pc('paparazzi.scene.upload', locale),
        inputTestId: 'paparazzi-scene-input'
      }"
      @pick="pick"
      @upload="upload"
    />
    <p class="px-1 text-[11px] text-primary-warm-gray">
      {{ pc('paparazzi.scene.note', locale) }}
    </p>
  </div>
</template>
