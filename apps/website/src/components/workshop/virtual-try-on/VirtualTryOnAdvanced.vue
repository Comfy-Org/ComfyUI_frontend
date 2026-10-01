<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorNumberField from '../app-editor/EditorNumberField.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { setup } = tryOn
</script>

<template>
  <EditorNumberField
    :model-value="setup.seed"
    :label="vc('tryOn.seed', locale)"
    @update:model-value="tryOn.setSeed"
  />
</template>
