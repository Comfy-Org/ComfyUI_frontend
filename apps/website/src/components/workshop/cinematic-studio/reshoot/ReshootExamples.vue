<script setup lang="ts">
import { computed } from 'vue'

import type { PlaygroundExample } from '../../../../config/workshop-playground'
import { RESHOOT_EXAMPLE } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ExamplesTab from '../../ExamplesTab.vue'

const { activeId, locale = 'en' } = defineProps<{
  activeId?: string
  locale?: Locale
}>()

const emit = defineEmits<{ pick: [] }>()

// computed, so the titles follow the page's language
const examples = computed<readonly PlaygroundExample[]>(() => [
  {
    id: 'crossview-example',
    title: rc('reshoot.pick.exampleTitle', locale),
    specs: [rc('reshoot.pick.exampleMeta', locale)],
    values: {},
    outputUrl: RESHOOT_EXAMPLE.clip,
    mediaKind: 'video'
  }
  // Only the worked example: the other tiles were stills with no clip behind
  // them, which a page that really runs could not keep its word on.
])
</script>

<template>
  <ExamplesTab
    :examples="examples"
    :active-id="activeId"
    :locale
    @open="emit('pick')"
  />
</template>
