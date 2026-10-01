<script setup lang="ts">
import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorNumberField from '../app-editor/EditorNumberField.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { seed } = swap
</script>

<template>
  <EditorNumberField v-model="seed" :label="hc('swap.seed', locale)" />
</template>
