<script setup lang="ts">
import type { useCinematicShot } from '../../../composables/useCinematicShot'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { StarterShot } from '../../../lib/workshop/cinematic-studio/starters'
import type { Locale } from '../../../i18n/translations'
import CinematicVideoStart from './CinematicVideoStart.vue'
import CinematicStage from './CinematicStage.vue'
const { shot, models, editingModels, starter, animationModel, locale } =
  defineProps<{
    shot: ReturnType<typeof useCinematicShot>
    models: readonly CinematicModel[]
    editingModels: readonly CinematicModel[]
    starter?: string
    animationModel?: CinematicModel
    locale: Locale
  }>()
const {
  mode,
  modeReel,
  scene,
  firstFrame,
  selectedModel,
  studio,
  frameLoading,
  useAsReference,
  animate,
  edit
} = shot
const emit = defineEmits<{
  startVideo: [prompt: string]
  upload: []
  saved: []
  start: [shot: StarterShot]
  again: []
  switchModel: [slug: string]
  editScene: []
}>()
</script>

<template>
  <CinematicVideoStart
    v-if="mode === 'video' && !modeReel.takes.length"
    :scene
    :has-frame="
      !!firstFrame && selectedModel?.video?.firstFrame !== 'unsupported'
    "
    :can-animate="!!animationModel"
    :disabled="studio.rendering.value || frameLoading"
    :locale
    @start="emit('startVideo', $event)"
    @upload="emit('upload')"
    @saved="emit('saved')"
  />
  <CinematicStage
    v-else
    :reel="modeReel"
    :models="[...models, ...editingModels]"
    :locale
    :starter
    @select="studio.select"
    @start="emit('start', $event)"
    @again="emit('again')"
    @reference="useAsReference"
    @animate="animate"
    @edit="edit"
    @switch-model="emit('switchModel', $event)"
    @edit-scene="emit('editScene')"
  />
</template>
