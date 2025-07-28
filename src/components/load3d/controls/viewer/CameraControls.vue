<template>
  <div class="space-y-4">
    <label>
      {{ t('load3d.viewer.cameraType') }}
    </label>
    <Select
      v-model="cameraType"
      :options="cameras"
      option-label="title"
      option-value="value"
    >
    </Select>
  </div>

  <div v-if="showFOVButton" class="space-y-4">
    <label>{{ t('load3d.fov') }}</label>
    <Slider v-model="fov" :min="10" :max="150" :step="1" aria-label="fov" />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import Slider from 'primevue/slider'
import { computed } from 'vue'

import { CameraType } from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'

const cameras = [
  { title: t('load3d.cameraType.perspective'), value: 'perspective' },
  { title: t('load3d.cameraType.orthographic'), value: 'orthographic' }
]

const cameraType = defineModel<CameraType>('cameraType')
const fov = defineModel<number>('fov')
const showFOVButton = computed(() => cameraType.value === 'perspective')
</script>
