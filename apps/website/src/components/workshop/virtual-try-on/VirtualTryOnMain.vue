<script setup lang="ts">
import { computed } from 'vue'

import type { VirtualTryOn } from '@/composables/useVirtualTryOn'
import type { Locale } from '@/i18n/translations'
import { vc } from '@/lib/workshop/virtual-try-on/copy'
import { TRY_ON_PEOPLE } from '@/lib/workshop/virtual-try-on/mock-run'
import EditorEmpty from '@/components/workshop/app-editor/EditorEmpty.vue'
import EditorResult from '@/components/workshop/app-editor/EditorResult.vue'
import VirtualTryOnWorkspace from './VirtualTryOnWorkspace.vue'
import { personAlt } from './person-alt'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { person, phase, comparing } = tryOn
const labels = computed(() => ({
  resultAlt: vc('tryOn.alt.result', locale),
  originalAlt: person.value ? personAlt(person.value, locale) : '',
  original: vc('tryOn.view.original', locale),
  result: vc('tryOn.view.result', locale),
  slider: vc('tryOn.compare', locale)
}))
</script>

<template>
  <EditorEmpty
    v-if="!person"
    :title="vc('tryOn.empty.title', locale)"
    :examples="
      TRY_ON_PEOPLE.map(({ id, image }) => ({
        id,
        image: image.url,
        label: vc(`tryOn.examples.${id}` as const, locale),
        fit: 'contain' as const
      }))
    "
    data-testid="try-on-empty"
    @example="tryOn.useExample"
  />
  <EditorResult
    v-else-if="phase.kind === 'done'"
    :before="person.url"
    :after="phase.result.url"
    :view="comparing ? 'compare' : 'result'"
    :width="person.width"
    :height="person.height"
    :labels
  />
  <VirtualTryOnWorkspace v-else :person :try-on :locale />
</template>
