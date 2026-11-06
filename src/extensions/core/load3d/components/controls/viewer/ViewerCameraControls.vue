<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-2">
      <label>{{ t('load3d.viewer.cameraType') }}</label>
      <Select v-model="cameraType">
        <SelectTrigger size="md">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="cam in cameras"
            :key="cam.value"
            :value="cam.value"
          >
            {{ cam.title }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="showFOVButton" class="flex flex-col gap-2">
      <label>{{ t('load3d.fov') }}</label>
      <Slider
        :model-value="fovSliderValue"
        :min="10"
        :max="150"
        :step="1"
        :aria-label="t('load3d.fov')"
        @update:model-value="onFovUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Select from '@comfyorg/design-system/select/Select'
import SelectContent from '@comfyorg/design-system/select/SelectContent'
import SelectItem from '@comfyorg/design-system/select/SelectItem'
import SelectTrigger from '@comfyorg/design-system/select/SelectTrigger'
import SelectValue from '@comfyorg/design-system/select/SelectValue'
import Slider from '@comfyorg/design-system/slider/Slider'
import type { CameraType } from '@comfyorg/viewport3d/load3d/interfaces'

const { t } = useI18n()
const cameras = [
  { title: t('load3d.cameraType.perspective'), value: 'perspective' },
  { title: t('load3d.cameraType.orthographic'), value: 'orthographic' }
]

const cameraType = defineModel<CameraType>('cameraType')
const fov = defineModel<number>('fov')
const showFOVButton = computed(() => cameraType.value === 'perspective')

const fovSliderValue = computed(() => [fov.value ?? 10])

function onFovUpdate(val: number[] | undefined) {
  if (val?.length) fov.value = val[0]
}
</script>
