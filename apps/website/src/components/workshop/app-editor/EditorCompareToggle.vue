<script setup lang="ts">
import { Columns2 } from '@lucide/vue'

import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
import EditorTool from './EditorTool.vue'

const { label, locale = 'en' } = defineProps<{
  /** "Compare" unless the app names it. */
  label?: string
  locale?: Locale
}>()
const comparing = defineModel<boolean>({ required: true })
const { t } = translationsFor(locale)
</script>

<template>
  <EditorTool
    :icon="Columns2"
    :label="label ?? t('cinematic.compare.label')"
    :pressed="comparing"
    @click="comparing = !comparing"
  />
</template>
