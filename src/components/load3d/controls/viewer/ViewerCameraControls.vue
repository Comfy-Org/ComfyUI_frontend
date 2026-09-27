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

import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import type { CameraType } from '@/extensions/core/load3d/interfaces'

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
