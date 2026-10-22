<script setup lang="ts">
import { Columns2, Film, RotateCcw, Sparkles } from '@lucide/vue'

import EditorDivider from '@/components/workshop/app-editor/EditorDivider.vue'
import EditorTool from '@/components/workshop/app-editor/EditorTool.vue'
import type { EditorView } from '@/components/workshop/app-editor/view'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** The dock under a finished take: how to show it, and the way back to its settings. */
const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const view = defineModel<EditorView>('view', { required: true })
const emit = defineEmits<{ reuse: [] }>()

const VIEWS = [
  { id: 'compare', icon: Columns2, label: 'cinematic.compare.label' },
  { id: 'result', icon: Sparkles, label: 'reshoot.view.result' },
  { id: 'original', icon: Film, label: 'reshoot.view.source' }
] as const
</script>

<template>
  <EditorTool
    v-for="option in VIEWS"
    :key="option.id"
    :icon="option.icon"
    :label="t(option.label)"
    :pressed="view === option.id"
    @click="view = option.id"
  />
  <EditorDivider />
  <EditorTool
    :icon="RotateCcw"
    :label="t('openjutsu.take.reuse')"
    @click="emit('reuse')"
  />
</template>
