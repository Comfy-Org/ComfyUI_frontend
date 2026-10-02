<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { onMounted, ref, useTemplateRef } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import CinematicPopover from '../cinematic-studio/CinematicPopover.vue'
import PaparazziSceneGrid from './PaparazziSceneGrid.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const wide = useMediaQuery('(min-width: 1024px)')
const sheet = useTemplateRef<InstanceType<typeof CinematicPopover>>('sheet')
const top = ref<number>()

onMounted(() => {
  const trigger = document
    .querySelector('[data-testid="paparazzi-scene-row"]')
    ?.getBoundingClientRect()
  const box = sheet.value?.$el
  if (!trigger || !(box instanceof HTMLElement)) return
  const height = box.getBoundingClientRect().height
  const centred = trigger.top + trigger.height / 2 - height / 2
  top.value = Math.max(60, Math.min(centred, window.innerHeight - height - 16))
})
</script>

<template>
  <div
    class="pointer-events-auto fixed inset-0 z-50 bg-black/60 lg:hidden"
    aria-hidden="true"
  />
  <CinematicPopover
    ref="sheet"
    :title="pc('paparazzi.scene.pick', locale)"
    :locale
    class="pointer-events-auto fixed inset-x-0 bottom-0 z-50 max-h-[80svh] rounded-b-none lg:top-15 lg:right-auto lg:bottom-auto lg:left-[calc(var(--container-editor-panel)+1.5rem)] lg:max-h-[calc(100svh-5rem)] lg:w-120 lg:rounded-b-2xl"
    :style="wide && top !== undefined ? { top: `${top}px` } : undefined"
    @close="paparazzi.closePicker"
  >
    <PaparazziSceneGrid :paparazzi :locale @picked="paparazzi.closePicker" />
  </CinematicPopover>
</template>
