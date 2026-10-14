<script setup lang="ts">
import { computed } from 'vue'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import { brc } from '@/lib/workshop/background-removal/copy'
import {
  CUTOUT_EXAMPLE,
  CUTOUT_EXAMPLES
} from '@/lib/workshop/background-removal/mask'
import EditorEmpty from '@/components/workshop/app-editor/EditorEmpty.vue'
import EditorResult from '@/components/workshop/app-editor/EditorResult.vue'
import type { EditorView } from '@/components/workshop/app-editor/view'
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
    :examples="
      CUTOUT_EXAMPLES.map(({ id, image }) => ({
        id,
        image: image.url,
        label: brc(`cutout.examples.${id}` as const, locale)
      }))
    "
    data-testid="background-removal-empty"
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
    :checker="phase.result.transparent"
  />
  <BackgroundRemovalWorkspace v-else :image :cutout :locale />
</template>
