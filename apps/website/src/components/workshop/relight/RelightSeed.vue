<script setup lang="ts">
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorSeedField from '../app-editor/EditorSeedField.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup } = relight
</script>

<template>
  <EditorSeedField
    :model-value="setup.generation.seed"
    :label="lc('relight.generation.seed', locale)"
    :shuffle-label="lc('relight.generation.shuffle', locale)"
    @update:model-value="(seed) => relight.updateGeneration({ seed }, 'seed')"
  />
</template>
