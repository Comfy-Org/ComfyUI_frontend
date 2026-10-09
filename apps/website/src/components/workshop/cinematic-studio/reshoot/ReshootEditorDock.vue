<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import {
  AudioLines,
  Clapperboard,
  Film,
  RotateCcw,
  Volume2,
  Waypoints
} from '@lucide/vue'

import EditorDivider from '@/components/workshop/app-editor/EditorDivider.vue'
import EditorTool from '@/components/workshop/app-editor/EditorTool.vue'
import type { Locale } from '@/i18n/translations'
import type { ReshootSound, ReshootView } from './output'

/** The dock under a finished take: which picture and sound, and its angle again. */
const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const view = defineModel<ReshootView>('view', { required: true })
const sound = defineModel<ReshootSound>('sound', { required: true })
const emit = defineEmits<{ reuse: [] }>()

const VIEWS = [
  { id: 'result', icon: Clapperboard },
  { id: 'warp', icon: Waypoints },
  { id: 'source', icon: Film }
] as const
const SOUNDS = [
  { id: 'generated', icon: AudioLines },
  { id: 'original', icon: Volume2 }
] as const
</script>

<template>
  <EditorTool
    v-for="option in VIEWS"
    :key="option.id"
    :icon="option.icon"
    :label="t(`reshoot.view.${option.id}`)"
    :pressed="view === option.id"
    @click="view = option.id"
  />
  <template v-if="view === 'result'">
    <EditorDivider />
    <EditorTool
      v-for="option in SOUNDS"
      :key="option.id"
      :icon="option.icon"
      :label="t(`reshoot.sound.${option.id}`)"
      :pressed="sound === option.id"
      @click="sound = option.id"
    />
  </template>
  <EditorDivider />
  <EditorTool
    :icon="RotateCcw"
    :label="t('reshoot.reuse')"
    @click="emit('reuse')"
  />
</template>
