<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import { useSceneThumbnails } from '../../../composables/useSceneThumbnails'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import {
  SCENE_IDS,
  SCENE_LABELS,
  isCustomScene
} from '../../../lib/workshop/paparazzi-me/setup'
import EditorTextArea from '../app-editor/EditorTextArea.vue'
import PaparazziSceneTile from './PaparazziSceneTile.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup } = paparazzi
const thumbnails = useSceneThumbnails()
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="pc('paparazzi.scene', locale)"
    class="grid grid-cols-2 gap-x-2.5 gap-y-3.5 px-1"
  >
    <PaparazziSceneTile
      v-for="scene in SCENE_IDS"
      :key="scene"
      :scene
      :src="thumbnails[scene]"
      :label="pc(SCENE_LABELS[scene], locale)"
      :checked="!isCustomScene(setup) && setup.scene === scene"
      :dimmed="isCustomScene(setup)"
      @pick="paparazzi.pickScene(scene)"
    />
  </div>
  <EditorTextArea
    :model-value="setup.sceneOverride"
    :label="pc('paparazzi.scene.override', locale)"
    :placeholder="pc('paparazzi.scene.overridePlaceholder', locale)"
    class="pt-2"
    @update:model-value="
      (sceneOverride) => paparazzi.change({ sceneOverride }, 'override')
    "
  />
</template>
