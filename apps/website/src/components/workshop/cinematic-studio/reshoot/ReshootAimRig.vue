<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  CameraAxis,
  ReshootCamera
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  CAMERA_RANGES,
  cameraZone
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import type { ReshootCopyKey } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootBarField from './ReshootBarField.vue'
import ReshootGlobe from './ReshootGlobe.vue'
import ReshootZone from './ReshootZone.vue'

const {
  clip,
  camera,
  disabled = false,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  disabled?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ aim: [patch: Partial<ReshootCamera>] }>()
const keepAim = defineModel<boolean>('keepAim', { required: true })

interface Field {
  axis: CameraAxis
  label: ReshootCopyKey
  format: (value: number) => string
}

const degrees = (value: number) => `${value}°`
const fixed = (value: number) => value.toFixed(2)

const MAIN: readonly Field[] = [
  { axis: 'azimuth', label: 'reshoot.axis.rotation', format: degrees },
  { axis: 'elevation', label: 'reshoot.axis.tilt', format: degrees },
  { axis: 'distance', label: 'reshoot.axis.distance', format: fixed }
]
const MORE: readonly Field[] = [
  { axis: 'fov', label: 'reshoot.axis.lens', format: degrees },
  { axis: 'shift', label: 'reshoot.axis.height', format: fixed }
]

const expanded = ref(false)
const zone = computed(() => cameraZone(camera))
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-center text-xs text-primary-warm-gray">
      {{ rc('reshoot.aim.globe', locale) }}
    </p>
    <ReshootGlobe :clip :camera :disabled :locale @aim="emit('aim', $event)" />
    <ReshootZone :zone class="mx-auto mb-1">
      {{ rc(`reshoot.zone.${zone}`, locale) }}
    </ReshootZone>
    <ReshootBarField
      v-for="{ axis, label, format } in MAIN"
      :key="axis"
      :model-value="camera[axis]"
      :label="rc(label, locale)"
      :display="format(camera[axis])"
      v-bind="CAMERA_RANGES[axis]"
      :disabled
      @update:model-value="emit('aim', { [axis]: $event })"
    />
    <p class="text-[11px]/relaxed text-primary-warm-gray">
      {{ rc('reshoot.distanceHelp', locale) }}
      {{ rc('reshoot.cameraHelp', locale) }}
    </p>
    <button
      type="button"
      :aria-expanded="expanded"
      class="flex h-8 items-center gap-1.5 text-xs text-primary-warm-gray hover:text-primary-warm-white"
      @click="expanded = !expanded"
    >
      {{ rc(expanded ? 'reshoot.aim.less' : 'reshoot.aim.more', locale) }}
      <ChevronDown
        :class="cn('size-3.5 transition-transform', expanded && 'rotate-180')"
        aria-hidden="true"
      />
    </button>
    <div
      v-if="expanded"
      class="flex flex-col gap-2 border-t border-transparency-white-t8 pt-2"
    >
      <ReshootBarField
        v-for="{ axis, label, format } in MORE"
        :key="axis"
        :model-value="camera[axis]"
        :label="rc(label, locale)"
        :display="format(camera[axis])"
        v-bind="CAMERA_RANGES[axis]"
        :disabled
        @update:model-value="emit('aim', { [axis]: $event })"
      />
      <label
        class="flex cursor-pointer items-center gap-2.5 py-1 text-xs text-primary-warm-white"
      >
        <input
          v-model="keepAim"
          type="checkbox"
          :disabled
          class="accent-primary-comfy-yellow"
        />
        {{ rc('reshoot.keepAim', locale) }}
      </label>
      <p class="text-[11px]/relaxed text-primary-warm-gray">
        {{ rc('reshoot.keepAimHelp', locale) }}
      </p>
    </div>
  </div>
</template>
