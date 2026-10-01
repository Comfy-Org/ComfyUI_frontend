<script setup lang="ts">
import { computed } from 'vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import type { TryOnFit } from '../../../lib/workshop/virtual-try-on/garments'
import { TRY_ON_FITS } from '../../../lib/workshop/virtual-try-on/garments'
import EditorTiles from '../app-editor/EditorTiles.vue'
import VirtualTryOnFitThumb from './VirtualTryOnFitThumb.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const options = TRY_ON_FITS.map((id) => ({
  id,
  label: vc(`tryOn.fit.${id}`, locale)
}))
const fit = computed({
  get: () => tryOn.setup.value.fit,
  set: (next?: TryOnFit) => next && tryOn.setFit(next)
})
</script>

<template>
  <EditorTiles v-model="fit" :label="vc('tryOn.fit', locale)" :options>
    <template #tile="{ option }">
      <VirtualTryOnFitThumb :fit="option.id" />
    </template>
  </EditorTiles>
</template>
