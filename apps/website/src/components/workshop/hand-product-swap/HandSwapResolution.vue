<script setup lang="ts">
import { computed } from 'vue'

import type { HandProductSwap } from '@/composables/useHandProductSwap'
import type { Locale } from '@/i18n/translations'
import {
  SWAP_RESOLUTIONS,
  outputSize
} from '@/lib/workshop/hand-product-swap/contract'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import EditorOutput from '@/components/workshop/app-editor/EditorOutput.vue'

const {
  swap,
  locale = 'en',
  composer = false
} = defineProps<{
  swap: HandProductSwap
  locale?: Locale
  composer?: boolean
}>()

const { resolution, hand, phase } = swap
const options = computed(() =>
  SWAP_RESOLUTIONS.map((id) => ({
    id,
    label: id,
    detail: hand.value
      ? hc(
          'swap.resolution.size',
          locale,
          outputSize(id, hand.value.width, hand.value.height)
        )
      : undefined
  }))
)
</script>

<template>
  <EditorOutput
    v-model="resolution"
    :heading="hc('swap.resolution', locale)"
    :options
    :label="hc('swap.resolution', locale)"
    :composer
    :disabled="composer && phase.kind === 'running'"
  />
</template>
