<script setup lang="ts">
import { computed } from 'vue'

import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import { RELIGHT_EXAMPLE } from '@/lib/workshop/relight/mock-run'
import EditorEmpty from '@/components/workshop/app-editor/EditorEmpty.vue'
import EditorResult from '@/components/workshop/app-editor/EditorResult.vue'
import type { EditorView } from '@/components/workshop/app-editor/view'
import RelightWorkspace from './RelightWorkspace.vue'

const {
  relight,
  view,
  locale = 'en'
} = defineProps<{
  relight: Relight
  view: EditorView
  locale?: Locale
}>()

const { image, phase } = relight
const resultLabels = computed(() => ({
  resultAlt: lc('relight.alt.result', locale),
  originalAlt:
    image.value?.url === RELIGHT_EXAMPLE.url
      ? lc('relight.alt.example', locale)
      : (image.value?.name ?? ''),
  original: lc('relight.view.original', locale),
  result: lc('relight.view.result', locale),
  slider: lc('relight.compare', locale)
}))
</script>

<template>
  <EditorEmpty
    v-if="!image"
    :title="lc('relight.empty.title', locale)"
    :meta="lc('relight.empty.meta', locale)"
    :upload-label="lc('relight.empty.upload', locale)"
    :example-label="lc('relight.empty.example', locale)"
    :example-image="RELIGHT_EXAMPLE.url"
    data-testid="relight-empty"
    @file="relight.useFile"
    @example="relight.useExample"
  />
  <EditorResult
    v-else-if="phase.kind === 'done'"
    :before="image.url"
    :after="phase.result.url"
    :view
    :width="image.width"
    :height="image.height"
    :labels="resultLabels"
  />
  <RelightWorkspace v-else :image :relight :locale />
</template>
