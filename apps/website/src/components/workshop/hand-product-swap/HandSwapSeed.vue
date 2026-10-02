<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorSeedField from '../app-editor/EditorSeedField.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { seed } = swap
</script>

<template>
  <EditorSeedField
    v-model="seed"
    :label="hc('swap.seed', locale)"
    :shuffle-label="hc('swap.seed.shuffle', locale)"
  />
</template>
