<script setup lang="ts">
import { computed } from 'vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorResult from '../app-editor/EditorResult.vue'
import VirtualTryOnWorkspace from './VirtualTryOnWorkspace.vue'
import { personAlt } from './person-alt'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { person, phase, view } = tryOn
const labels = computed(() => ({
  resultAlt: vc('tryOn.alt.result', locale),
  originalAlt: personAlt(person.value, locale),
  original: vc('tryOn.view.original', locale),
  result: vc('tryOn.view.result', locale),
  slider: vc('tryOn.compare', locale)
}))
</script>

<template>
  <EditorResult
    v-if="phase.kind === 'done'"
    :before="person.url"
    :after="phase.result.url"
    :view
    :width="person.width"
    :height="person.height"
    :labels
  />
  <VirtualTryOnWorkspace v-else :try-on :locale />
</template>
