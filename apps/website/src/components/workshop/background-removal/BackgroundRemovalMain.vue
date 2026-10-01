<script setup lang="ts">
import { computed } from 'vue'

import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import { CUTOUT_EXAMPLE } from '../../../lib/workshop/background-removal/mask'
import EditorEmpty from '../app-editor/EditorEmpty.vue'
import EditorResult from '../app-editor/EditorResult.vue'
import type { EditorView } from '../app-editor/view'
import BackgroundRemovalWorkspace from './BackgroundRemovalWorkspace.vue'

const {
  cutout,
  view,
  locale = 'en'
} = defineProps<{
  cutout: BackgroundRemoval
  view: EditorView
  locale?: Locale
}>()

const { image, phase } = cutout
const resultLabels = computed(() => ({
  resultAlt: brc('cutout.alt.result', locale),
  originalAlt:
    image.value?.url === CUTOUT_EXAMPLE.url
      ? brc('cutout.alt.example', locale)
      : (image.value?.name ?? ''),
  original: brc('cutout.view.original', locale),
  result: brc('cutout.view.result', locale),
  slider: brc('cutout.compare', locale)
}))
</script>

<template>
  <EditorEmpty
    v-if="!image"
    :title="brc('cutout.empty.title', locale)"
    :meta="brc('cutout.empty.meta', locale)"
    :upload-label="brc('cutout.empty.upload', locale)"
    :example-label="brc('cutout.empty.example', locale)"
    :example-image="CUTOUT_EXAMPLE.url"
    data-testid="background-removal-empty"
    @file="cutout.useFile"
    @example="cutout.useExample"
  />
  <EditorResult
    v-else-if="phase.kind === 'done'"
    :before="image.url"
    :after="phase.result.url"
    :view
    :width="image.width"
    :height="image.height"
    :labels="resultLabels"
    :checker="phase.result.background === 'transparent'"
  />
  <BackgroundRemovalWorkspace v-else :image :cutout :locale />
</template>
