<template>
  <div class="flex flex-col gap-2">
    <label>{{ $t('load3d.lightIntensity') }}</label>

    <Slider
      :model-value="sliderValue"
      class="w-full"
      :min="lightIntensityMinimum"
      :max="lightIntensityMaximum"
      :step="lightAdjustmentIncrement"
      @update:model-value="onSliderUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Slider from '@/components/ui/slider/Slider.vue'
import { useSettingStore } from '@/platform/settings/settingStore'

const lightIntensity = defineModel<number>('lightIntensity')

const lightIntensityMaximum = useSettingStore().get(
  'Comfy.Load3D.LightIntensityMaximum'
)
const lightIntensityMinimum = useSettingStore().get(
  'Comfy.Load3D.LightIntensityMinimum'
)
const lightAdjustmentIncrement = useSettingStore().get(
  'Comfy.Load3D.LightAdjustmentIncrement'
)

const sliderValue = computed(() => [
  lightIntensity.value ?? lightIntensityMinimum
])

function onSliderUpdate(val: number[] | undefined) {
  if (val?.length) lightIntensity.value = val[0]
}
</script>
