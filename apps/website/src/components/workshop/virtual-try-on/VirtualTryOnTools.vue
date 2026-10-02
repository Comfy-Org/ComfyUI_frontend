<script setup lang="ts">
import { Shirt } from '@lucide/vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorTool from '../app-editor/EditorTool.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { phase, guide, garment } = tryOn
</script>

<template>
  <EditorTool
    :icon="Shirt"
    :label="vc('tryOn.tool.guide', locale)"
    :pressed="guide"
    :disabled="phase.kind === 'running' || !garment"
    @click="guide = !guide"
  />
</template>
