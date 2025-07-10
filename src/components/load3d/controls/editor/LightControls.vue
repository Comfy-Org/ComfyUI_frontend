<template>
  <label>{{ t('load3d.lightIntensity') }}</label>

  <Slider
    v-model="lightIntensity"
    class="w-full"
    :min="lightIntensityMinimum"
    :max="lightIntensityMaximum"
    :step="lightAdjustmentIncrement"
    @change="updateLightIntensity"
  />
</template>

<script setup lang="ts">
import Slider from 'primevue/slider'
import { ref, watch } from 'vue'

import { t } from '@/i18n'
import { useSettingStore } from '@/stores/settingStore'

const props = defineProps<{
  lightIntensity: number
}>()

const emit = defineEmits<{
  (e: 'updateLightIntensity', value: number): void
}>()

const lightIntensity = ref(props.lightIntensity)

const lightIntensityMaximum = useSettingStore().get(
  'Comfy.Load3D.LightIntensityMaximum'
)
const lightIntensityMinimum = useSettingStore().get(
  'Comfy.Load3D.LightIntensityMinimum'
)
const lightAdjustmentIncrement = useSettingStore().get(
  'Comfy.Load3D.LightAdjustmentIncrement'
)

watch(
  () => props.lightIntensity,
  (newValue) => {
    lightIntensity.value = newValue
  }
)

const updateLightIntensity = () => {
  emit('updateLightIntensity', lightIntensity.value)
}
</script>
