<script setup lang="ts">
import { translationsFor } from '../../../../i18n/translations'
import { computed } from 'vue'

import type { PlaygroundExample } from '../../../../config/workshop-playground'
import { RESHOOT_EXAMPLE } from '../../../../lib/workshop/cinematic-studio/reshoot'
import type { Locale } from '../../../../i18n/translations'
import ExamplesTab from '../../ExamplesTab.vue'

const { activeId, locale = 'en' } = defineProps<{
  activeId?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ pick: [] }>()

// computed, so the titles follow the page's language
const examples = computed<readonly PlaygroundExample[]>(() => [
  {
    id: 'crossview-example',
    title: t('reshoot.pick.exampleTitle'),
    specs: [t('reshoot.pick.exampleMeta')],
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
    :gallery-label="t('reshoot.title')"
    :active-id="activeId"
    :locale
    @open="emit('pick')"
  />
</template>
