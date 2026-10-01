<script setup lang="ts">
import { computed } from 'vue'

import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import type { CutoutBackground } from '../../../lib/workshop/background-removal/contract'
import { CUTOUT_BACKGROUNDS } from '../../../lib/workshop/background-removal/contract'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorTiles from '../app-editor/EditorTiles.vue'
import BackgroundRemovalSwatch from './BackgroundRemovalSwatch.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { image, setup } = cutout
const options = CUTOUT_BACKGROUNDS.map((id) => ({
  id,
  label: brc(`cutout.background.${id}`, locale)
}))
const background = computed({
  get: () => setup.value.background,
  set: (next?: CutoutBackground) => next && cutout.update({ background: next })
})
</script>

<template>
  <EditorTiles
    v-model="background"
    :label="brc('cutout.background', locale)"
    :options
  >
    <template #tile="{ option }">
      <BackgroundRemovalSwatch :background="option.id" :image />
    </template>
  </EditorTiles>
</template>
