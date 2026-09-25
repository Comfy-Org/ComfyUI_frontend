<script setup lang="ts">
import { computed } from 'vue'

import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootMotion,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootCameraControls from './ReshootCameraControls.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'

const {
  clip,
  clipName,
  aspect,
  size,
  prompt,
  camera,
  keys,
  locale = 'en'
} = defineProps<{
  clip: string
  clipName: string
  aspect: ReshootAspect
  size: ReshootSize
  prompt: string
  camera: Readonly<ReshootCamera>
  keys: readonly CameraKey[]
  locale?: Locale
}>()

const emit = defineEmits<{
  back: []
  aim: [patch: Partial<ReshootCamera>]
  key: []
  removeKey: [frame: number]
  clearKeys: []
}>()

const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const motion = defineModel<ReshootMotion>('motion', { required: true })

const summary = computed(() =>
  [
    aspect === 'source' ? rc('reshoot.aspect.source', locale) : aspect,
    size,
    prompt.trim()
  ]
    .filter(Boolean)
    .join(' · ')
)

const labelClass =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
</script>

<template>
  <section class="p-5">
    <div
      class="flex items-center gap-3 rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-2.5"
    >
      <video
        :src="clip"
        muted
        playsinline
        preload="metadata"
        class="aspect-video w-16 shrink-0 rounded-lg bg-primary-comfy-ink object-cover"
      />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-sm font-semibold text-primary-warm-white">
          {{ clipName }}
        </span>
        <span class="truncate text-xs text-primary-warm-gray">
          {{ summary }}
        </span>
      </span>
      <button
        type="button"
        class="h-8 shrink-0 rounded-full px-3 text-xs text-primary-warm-white ring-1 ring-transparency-white-t20 ring-inset hover:bg-transparency-white-t8"
        @click="emit('back')"
      >
        {{ rc('reshoot.edit', locale) }}
      </button>
    </div>
  </section>
  <section class="flex flex-col gap-2.5 p-5">
    <h2 :class="labelClass">{{ rc('reshoot.section.camera', locale) }}</h2>
    <ReshootCameraControls
      v-model:keep-aim="keepAim"
      :camera
      :locale
      @aim="emit('aim', $event)"
    />
  </section>
  <section class="flex flex-col gap-2.5 p-5">
    <h2 :class="labelClass">{{ rc('reshoot.section.move', locale) }}</h2>
    <ReshootMoveControls
      v-model:frame="frame"
      v-model:motion="motion"
      :keys
      :locale
      @key="emit('key')"
      @remove="emit('removeKey', $event)"
      @clear="emit('clearKeys')"
    />
  </section>
</template>
