<script setup lang="ts">
import { RotateCcw, SquareDashed } from '@lucide/vue'

import type { HandProductSwap } from '../../../composables/useHandProductSwap'
import type { Locale } from '../../../i18n/translations'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import EditorTool from '../app-editor/EditorTool.vue'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { drawing, phase } = swap
</script>

<template>
  <EditorTool
    :icon="SquareDashed"
    :label="hc('swap.tool.draw', locale)"
    :pressed="drawing"
    :disabled="phase.kind === 'running'"
    @click="drawing = !drawing"
  />
  <EditorTool
    :icon="RotateCcw"
    :label="hc('swap.tool.reset', locale)"
    icon-only
    :disabled="phase.kind === 'running'"
    @click="swap.resetBox"
  />
</template>
