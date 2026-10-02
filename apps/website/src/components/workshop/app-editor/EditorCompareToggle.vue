<script setup lang="ts">
import { Columns2 } from '@lucide/vue'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import EditorTool from './EditorTool.vue'

const { label, locale = 'en' } = defineProps<{
  /** "Compare" unless the app names it. */
  label?: string
  locale?: Locale
}>()
const comparing = defineModel<boolean>({ required: true })
</script>

<template>
  <EditorTool
    :icon="Columns2"
    :label="label ?? tc('cinematic.compare', locale)"
    :pressed="comparing"
    @click="comparing = !comparing"
  />
</template>
