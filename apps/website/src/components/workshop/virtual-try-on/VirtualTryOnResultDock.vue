<script setup lang="ts">
import { ChevronLeft, RefreshCw } from '@lucide/vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorCompareToggle from '../app-editor/EditorCompareToggle.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { comparing } = tryOn
</script>

<template>
  <EditorCompareToggle
    v-model="comparing"
    :label="vc('tryOn.view.compare', locale)"
    :locale
  />
  <EditorDivider />
  <EditorTool
    :icon="ChevronLeft"
    :label="vc('tryOn.edit', locale)"
    @click="tryOn.edit"
  />
  <EditorTool
    :icon="RefreshCw"
    :label="vc('tryOn.again', locale)"
    @click="tryOn.tryOn"
  />
</template>
