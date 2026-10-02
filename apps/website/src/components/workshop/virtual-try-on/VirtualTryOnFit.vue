<script setup lang="ts">
import { computed } from 'vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { TRY_ON_FITS } from '../../../lib/workshop/virtual-try-on/contract'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorSegmented from '../app-editor/EditorSegmented.vue'

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
  set: tryOn.setFit
})
</script>

<template>
  <EditorSegmented v-model="fit" :label="vc('tryOn.fit', locale)" :options />
</template>
