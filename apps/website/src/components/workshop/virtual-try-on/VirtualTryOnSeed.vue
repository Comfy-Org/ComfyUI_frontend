<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorSeedField from '../app-editor/EditorSeedField.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { setup } = tryOn
</script>

<template>
  <EditorSeedField
    :model-value="setup.seed"
    :label="vc('tryOn.seed', locale)"
    :shuffle-label="vc('tryOn.seed.shuffle', locale)"
    @update:model-value="tryOn.setSeed"
  />
</template>
