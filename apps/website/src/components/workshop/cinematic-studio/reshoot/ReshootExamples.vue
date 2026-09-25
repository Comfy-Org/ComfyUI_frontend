<script setup lang="ts">
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

const SAMPLES = [
  ['street', 'neon-street'],
  ['diner', 'diner'],
  ['train', 'train']
] as const

const EXAMPLES: readonly PlaygroundExample[] = [
  {
    id: 'crossview-example',
    title: rc('reshoot.pick.exampleTitle', locale),
    specs: [rc('reshoot.pick.exampleMeta', locale)],
    values: {},
    outputUrl: RESHOOT_EXAMPLE.clip,
    mediaKind: 'video'
  },
  ...SAMPLES.map(([key, image]) => ({
    id: `sample-${key}`,
    title: rc(`reshoot.sample.${key}`, locale),
    specs: [rc('reshoot.sample.meta', locale)],
    values: {},
    outputUrl: `/images/cinematic-studio/${image}.jpg`,
    mediaKind: 'image' as const
  }))
]
</script>

<template>
  <ExamplesTab
    :examples="EXAMPLES"
    :active-id="activeId"
    :locale
    @open="emit('pick')"
  />
</template>
