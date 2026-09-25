<script setup lang="ts">
import { computed } from 'vue'

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
import ReshootSlider from './ReshootSlider.vue'
import ReshootZone from './ReshootZone.vue'

const {
  camera,
  disabled = false,
  locale = 'en'
} = defineProps<{
  camera: Readonly<ReshootCamera>
  disabled?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ aim: [patch: Partial<ReshootCamera>] }>()
const keepAim = defineModel<boolean>('keepAim', { required: true })

const AXES: readonly {
  axis: CameraAxis
  label: ReshootCopyKey
  format: (value: number) => string
}[] = [
  { axis: 'azimuth', label: 'reshoot.axis.azimuth', format: (v) => `${v}°` },
  {
    axis: 'elevation',
    label: 'reshoot.axis.elevation',
    format: (v) => `${v}°`
  },
  {
    axis: 'distance',
    label: 'reshoot.axis.distance',
    format: (v) => v.toFixed(2)
  },
  { axis: 'fov', label: 'reshoot.axis.fov', format: (v) => `${v}°` },
  { axis: 'shift', label: 'reshoot.axis.shift', format: (v) => v.toFixed(2) }
]

const zone = computed(() => cameraZone(camera))
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <p
      v-if="disabled"
      class="rounded-xl bg-transparency-white-t8 px-3 py-2 text-xs text-primary-warm-white"
    >
      {{ rc('reshoot.needsDepth', locale) }}
    </p>
    <ReshootSlider
      v-for="{ axis, label, format } in AXES"
      :key="axis"
      :model-value="camera[axis]"
      :label="rc(label, locale)"
      :display="format(camera[axis])"
      v-bind="CAMERA_RANGES[axis]"
      :disabled
      @update:model-value="emit('aim', { [axis]: $event })"
    />
    <label
      class="flex cursor-pointer items-center gap-2.5 text-xs text-primary-warm-white"
    >
      <input
        v-model="keepAim"
        type="checkbox"
        :disabled
        class="accent-primary-comfy-yellow"
      />
      {{ rc('reshoot.keepAim', locale) }}
    </label>
    <ReshootZone :zone>
      {{ rc(`reshoot.zone.${zone}`, locale) }}
    </ReshootZone>
  </div>
</template>
