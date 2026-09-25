<script setup lang="ts">
import { KeyRound, X } from '@lucide/vue'
import { computed } from 'vue'

import type {
  CameraKey,
  ReshootMotion
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  RESHOOT_FRAMES,
  RESHOOT_MOTIONS,
  frameTime
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import CinematicMenu from '../CinematicMenu.vue'
import ReshootSlider from './ReshootSlider.vue'

const {
  keys,
  frames = RESHOOT_FRAMES,
  disabled = false,
  locale = 'en'
} = defineProps<{
  keys: readonly CameraKey[]
  frames?: number
  disabled?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ key: []; remove: [frame: number]; clear: [] }>()
const frame = defineModel<number>('frame', { required: true })
const motion = defineModel<ReshootMotion>('motion', { required: true })

const motionOptions = computed(() =>
  RESHOOT_MOTIONS.map((id) => ({
    id,
    label: rc(`reshoot.motion.${id}`, locale)
  }))
)
const motionValue = computed({
  get: () => motion.value,
  set: (id: string) => {
    const match = RESHOOT_MOTIONS.find((option) => option === id)
    if (match) motion.value = match
  }
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <p
      v-if="disabled"
      class="rounded-xl bg-transparency-white-t8 px-3 py-2 text-xs text-primary-warm-white"
    >
      {{ rc('reshoot.needsDepth', locale) }}
    </p>
    <p class="text-xs/relaxed text-primary-warm-gray">
      {{ rc('reshoot.move.help', locale) }}
    </p>
    <div class="flex items-end gap-3">
      <ReshootSlider
        v-model="frame"
        :label="rc('reshoot.move.frame', locale)"
        :display="frameTime(frame)"
        :min="0"
        :max="frames - 1"
        :step="1"
        :disabled
        class="flex-1"
      />
      <button
        type="button"
        :disabled
        class="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] text-primary-warm-white ring-1 ring-transparency-white-t20 ring-inset hover:bg-transparency-white-t8 disabled:opacity-40"
        @click="emit('key')"
      >
        <KeyRound class="size-3.5" aria-hidden="true" />
        {{ rc('reshoot.move.key', locale) }}
      </button>
    </div>
    <ul v-if="keys.length" class="flex flex-wrap gap-1.5">
      <li
        v-for="key in keys"
        :key="key.frame"
        class="flex h-7 items-center gap-1 rounded-lg bg-transparency-white-t8 pr-1 pl-2.5 font-mono text-[11px] text-primary-warm-white tabular-nums"
      >
        {{ frameTime(key.frame) }}
        <span class="text-primary-warm-gray">
          {{ key.camera.azimuth }}° / {{ key.camera.elevation }}°
        </span>
        <button
          type="button"
          :disabled
          class="grid size-5 place-items-center rounded-md text-primary-warm-gray hover:text-primary-warm-white"
          :aria-label="
            rc('reshoot.move.remove', locale).replace(
              '{time}',
              frameTime(key.frame)
            )
          "
          @click="emit('remove', key.frame)"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <div v-if="keys.length > 1" class="flex items-center gap-2">
      <CinematicMenu
        v-model="motionValue"
        :options="motionOptions"
        :heading="rc('reshoot.move.motion', locale)"
        trigger-class="h-9 flex-1 justify-between gap-2 border border-transparency-white-t20 px-3 text-sm text-primary-warm-white"
      >
        <span class="text-primary-warm-gray">
          {{ rc('reshoot.move.motion', locale) }}
        </span>
        {{ rc(`reshoot.motion.${motion}`, locale) }}
      </CinematicMenu>
      <button
        type="button"
        :disabled
        class="h-9 rounded-xl px-3 text-xs text-primary-warm-gray hover:text-primary-warm-white"
        @click="emit('clear')"
      >
        {{ rc('reshoot.move.clear', locale) }}
      </button>
    </div>
  </div>
</template>
