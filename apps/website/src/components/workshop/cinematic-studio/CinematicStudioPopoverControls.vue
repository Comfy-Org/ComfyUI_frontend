<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { DirectionPart } from '../../../lib/workshop/cinematic-studio/catalog'
import type { useCinematicShot } from '../../../composables/useCinematicShot'
import type { PopoverKey } from './picker-key'
import { pickerGroups, popoverTitle } from './picker-key'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicPicker from './CinematicPicker.vue'
import CinematicPopover from './CinematicPopover.vue'
import CinematicVideoControls from './CinematicVideoControls.vue'
import CinematicReferenceSlot from './CinematicReferenceSlot.vue'
import CinematicOutputControls from './CinematicOutputControls.vue'
const { shot, popover, directionStart, popoverClass, locale } = defineProps<{
  shot: ReturnType<typeof useCinematicShot>
  popover?: PopoverKey
  directionStart?: DirectionPart
  popoverClass: string
  locale: Locale
}>()
const {
  direction,
  mode,
  aspect,
  duration,
  videoResolution,
  audio,
  firstFrame,
  lastFrame,
  selectedModel,
  cast,
  palette,
  resolution,
  takes,
  enhance,
  choose
} = shot
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    v-if="popover"
    class="fixed inset-0 z-40 bg-black/60 lg:hidden"
    aria-hidden="true"
  />
  <CinematicPicker
    v-if="popover && pickerGroups(popover).length"
    :key="`${popover}-${directionStart}`"
    :groups="pickerGroups(popover)"
    :start="directionStart"
    :direction
    :title="popoverTitle(popover, locale)"
    :locale
    :class="popoverClass"
    @choose="choose"
    @close="emit('close')"
  />
  <CinematicPopover
    v-else-if="popover"
    :key="popover"
    :title="popoverTitle(popover, locale)"
    :locale
    :class="popoverClass"
    @close="emit('close')"
  >
    <CinematicVideoControls
      v-if="
        mode === 'video' && (popover === 'format' || popover === 'references')
      "
      v-model:aspect="aspect"
      v-model:duration="duration"
      v-model:resolution="videoResolution"
      v-model:audio="audio"
      v-model:first-frame="firstFrame"
      v-model:last-frame="lastFrame"
      :model="selectedModel"
      :locale
    />
    <div v-else-if="popover === 'references'" class="grid grid-cols-2 gap-2">
      <CinematicReferenceSlot v-model="cast" kind="cast" :locale />
      <CinematicReferenceSlot v-model="palette" kind="palette" :locale />
    </div>
    <div v-else class="flex flex-col gap-3">
      <CinematicOutputControls
        v-model:aspect="aspect"
        v-model:resolution="resolution"
        v-model:takes="takes"
        :allowed-aspects="selectedModel?.imageAspects"
        :locale
      />
      <label
        class="flex cursor-pointer items-center gap-2.5 rounded-xl px-1 text-xs text-primary-warm-white"
      >
        <input
          v-model="enhance"
          type="checkbox"
          role="switch"
          class="peer sr-only"
        />
        <span
          class="relative h-4 w-7 shrink-0 rounded-full bg-transparency-white-t20 transition-colors peer-checked:bg-primary-comfy-yellow peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/50 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-primary-comfy-ink after:transition-transform peer-checked:after:translate-x-3"
          aria-hidden="true"
        />
        {{ tc('cinematic.scene.enhance', locale) }}
        <span class="truncate text-primary-warm-gray">
          {{ tc('cinematic.scene.enhanceHint', locale) }}
        </span>
      </label>
    </div>
  </CinematicPopover>
</template>
