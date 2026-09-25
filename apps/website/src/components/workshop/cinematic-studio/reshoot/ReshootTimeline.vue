<script setup lang="ts">
import { KeyRound, Pause, Play } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  CameraKey,
  ReshootMotion
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  RESHOOT_MOTIONS,
  frameTime
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import CinematicMenu from '../CinematicMenu.vue'

// The clip's timeline under the live preview: play it, scrub it, and key the
// camera where the playhead is. Keys are the diamonds under the track; once
// there are two, the motion curve between them is chosen here too.
const {
  frames,
  fps,
  keys,
  keyed,
  locale = 'en'
} = defineProps<{
  frames: number
  fps: number
  keys: readonly CameraKey[]
  /** Whether the playhead sits on a key, which makes the button take it away. */
  keyed: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ key: []; clear: [] }>()
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

const playing = ref(false)
let timer: number | undefined
watch(playing, (on) => {
  window.clearInterval(timer)
  if (!on) return
  timer = window.setInterval(() => {
    frame.value = frame.value >= frames - 1 ? 0 : frame.value + 1
  }, 1000 / fps)
})
onBeforeUnmount(() => window.clearInterval(timer))

const left = (at: number) => `${(at / Math.max(1, frames - 1)) * 100}%`
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="reshoot-timeline">
    <div class="flex items-center gap-3">
      <button
        type="button"
        :aria-label="rc(playing ? 'reshoot.pause' : 'reshoot.play', locale)"
        :title="rc(playing ? 'reshoot.pause' : 'reshoot.play', locale)"
        class="grid size-9 shrink-0 place-items-center rounded-full text-primary-warm-white ring-1 ring-transparency-white-t20 ring-inset hover:bg-transparency-white-t8"
        @click="playing = !playing"
      >
        <Pause v-if="playing" class="size-4" aria-hidden="true" />
        <Play v-else class="size-4" aria-hidden="true" />
      </button>
      <div class="relative flex-1 pb-2">
        <input
          v-model.number="frame"
          type="range"
          :min="0"
          :max="frames - 1"
          :step="1"
          :aria-label="rc('reshoot.move.frame', locale)"
          :aria-valuetext="frameTime(frame)"
          class="w-full accent-primary-comfy-yellow"
        />
        <button
          v-for="key in keys"
          :key="key.frame"
          type="button"
          :aria-label="
            rc('reshoot.move.goTo', locale).replace(
              '{time}',
              frameTime(key.frame)
            )
          "
          :class="
            cn(
              'absolute bottom-0 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px]',
              key.frame === frame
                ? 'bg-primary-comfy-yellow'
                : 'bg-primary-comfy-yellow/50 hover:bg-primary-comfy-yellow'
            )
          "
          :style="{ left: left(key.frame) }"
          @click="frame = key.frame"
        />
      </div>
      <span
        class="w-24 shrink-0 text-right font-mono text-xs text-primary-warm-gray tabular-nums"
      >
        {{ frameTime(frame) }} / {{ frameTime(frames - 1) }}
      </span>
      <button
        type="button"
        :aria-pressed="keyed"
        :class="
          cn(
            // one width for both labels, so the row does not jump on a key
            'flex h-9 w-32 shrink-0 items-center justify-center gap-1.5 rounded-xl text-[13px] ring-1 ring-inset',
            keyed
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink ring-primary-comfy-yellow'
              : 'text-primary-warm-white ring-transparency-white-t20 hover:bg-transparency-white-t8'
          )
        "
        data-testid="reshoot-key"
        @click="emit('key')"
      >
        <KeyRound class="size-3.5" aria-hidden="true" />
        {{ rc(keyed ? 'reshoot.move.unkey' : 'reshoot.move.key', locale) }}
      </button>
    </div>
    <div class="flex min-h-9 items-center gap-2 pl-12">
      <template v-if="keys.length > 1">
        <CinematicMenu
          v-model="motionValue"
          :options="motionOptions"
          :heading="rc('reshoot.move.motion', locale)"
          trigger-class="h-9 gap-2 border border-transparency-white-t20 px-3 text-sm text-primary-warm-white"
        >
          <span class="text-primary-warm-gray">
            {{ rc('reshoot.move.motion', locale) }}
          </span>
          {{ rc(`reshoot.motion.${motion}`, locale) }}
        </CinematicMenu>
        <button
          type="button"
          class="h-9 rounded-xl px-3 text-xs text-primary-warm-gray hover:text-primary-warm-white"
          @click="emit('clear')"
        >
          {{ rc('reshoot.move.clear', locale) }}
        </button>
      </template>
      <p v-else class="text-xs text-primary-warm-gray">
        {{
          rc(
            keys.length ? 'reshoot.move.oneKey' : 'reshoot.move.noKeys',
            locale
          )
        }}
      </p>
    </div>
  </div>
</template>
