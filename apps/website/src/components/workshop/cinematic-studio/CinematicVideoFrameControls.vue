<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import CinematicReferenceSlot from './CinematicReferenceSlot.vue'
const { video, locale } = defineProps<{
  video: NonNullable<CinematicModel['video']>
  locale: Locale
}>()
const firstFrame = defineModel<File | undefined>('firstFrame')
const lastFrame = defineModel<File | undefined>('lastFrame')
</script>

<template>
  <div v-if="video.firstFrame !== 'unsupported'" class="grid grid-cols-2 gap-2">
    <CinematicReferenceSlot v-model="firstFrame" kind="firstFrame" :locale />
    <CinematicReferenceSlot
      v-if="video.lastFrame"
      v-model="lastFrame"
      kind="lastFrame"
      :locale
    />
  </div>
</template>
