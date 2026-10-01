<script setup lang="ts">
import { computed } from 'vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import {
  SWAP_RESOLUTIONS,
  outputSize
} from '../../../lib/workshop/hand-product-swap/contract'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorSegmented from '../app-editor/EditorSegmented.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { resolution, hand } = swap
const options = SWAP_RESOLUTIONS.map((id) => ({ id, label: id }))
const size = computed(() =>
  hand.value
    ? hc(
        'swap.resolution.size',
        locale,
        outputSize(resolution.value, hand.value.width, hand.value.height)
      )
    : ''
)
</script>

<template>
  <EditorSegmented
    v-model="resolution"
    :label="hc('swap.resolution', locale)"
    :options
    fill
  />
  <p class="px-1 text-[11px] text-primary-warm-gray tabular-nums">
    {{ size }}
  </p>
</template>
