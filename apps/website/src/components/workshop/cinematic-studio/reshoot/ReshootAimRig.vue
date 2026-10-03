<script setup lang="ts">
import { translationsFor } from '../../../../i18n/translations'
import { computed } from 'vue'

import type {
  CameraAxis,
  ReshootCamera
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  CAMERA_RANGES,
  cameraZone
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import type { ReshootCopyKey } from '../../../../lib/workshop/cinematic-studio/copy'
import InfoTooltip from '@/components/ui/tooltip/InfoTooltip.vue'
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
const { t } = translationsFor(locale)

const emit = defineEmits<{ aim: [patch: Partial<ReshootCamera>] }>()
const keepAim = defineModel<boolean>('keepAim', { required: true })

interface Field {
  axis: CameraAxis
  label: ReshootCopyKey
  format: (value: number) => string
  hint?: ReshootCopyKey
}

const degrees = (value: number) => `${value}°`
const fixed = (value: number) => value.toFixed(2)

const MAIN: readonly Field[] = [
  { axis: 'azimuth', label: 'reshoot.axis.rotation', format: degrees },
  { axis: 'elevation', label: 'reshoot.axis.tilt', format: degrees },
  {
    axis: 'distance',
    label: 'reshoot.axis.distance',
    format: fixed,
    hint: 'reshoot.distanceHelp'
  }
]
const MORE: readonly Field[] = [
  { axis: 'fov', label: 'reshoot.axis.lens', format: degrees },
  { axis: 'shift', label: 'reshoot.axis.height', format: fixed }
]

const zone = computed(() => cameraZone(camera))
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-center text-xs text-primary-warm-gray">
      {{ t('reshoot.aim.globe') }}
    </p>
    <ReshootGlobe :clip :camera :disabled :locale @aim="emit('aim', $event)" />
    <ReshootZone :zone class="mx-auto mb-1">
      {{ t(`reshoot.zone.${zone}`) }}
    </ReshootZone>
    <ReshootBarField
      v-for="{ axis, label, format, hint } in MAIN"
      :key="axis"
      :model-value="camera[axis]"
      :label="t(label)"
      :hint="hint && t(hint)"
      :display="format(camera[axis])"
      v-bind="CAMERA_RANGES[axis]"
      :disabled
      @update:model-value="emit('aim', { [axis]: $event })"
    />
    <div class="flex flex-col gap-2">
      <ReshootBarField
        v-for="{ axis, label, format } in MORE"
        :key="axis"
        :model-value="camera[axis]"
        :label="t(label)"
        :display="format(camera[axis])"
        v-bind="CAMERA_RANGES[axis]"
        :disabled
        @update:model-value="emit('aim', { [axis]: $event })"
      />
      <div class="flex items-center gap-1.5">
        <label
          class="flex cursor-pointer items-center gap-2.5 py-1 text-xs text-primary-warm-white"
        >
          <input
            v-model="keepAim"
            type="checkbox"
            :disabled
            class="accent-primary-comfy-yellow"
          />
          {{ t('reshoot.keepAim') }}
        </label>
        <InfoTooltip
          :text="t('reshoot.keepAimHelp')"
          :label="t('reshoot.keepAimHelp')"
        />
      </div>
    </div>
  </div>
</template>
