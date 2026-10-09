<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { Columns2 } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import EditorTool from './EditorTool.vue'

const { label, locale = 'en' } = defineProps<{
  /** "Compare" unless the app names it. */
  label?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const comparing = defineModel<boolean>({ required: true })
</script>

<template>
  <EditorTool
    :icon="Columns2"
    :label="label ?? t('cinematic.compare.label')"
    :pressed="comparing"
    @click="comparing = !comparing"
  />
</template>
