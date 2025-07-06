<template>
  <div class="flex flex-col">
    <div v-if="showLightIntensityButton" class="relative show-light-intensity">
      <Button
        class="p-button-rounded p-button-text"
        @click="toggleLightIntensity"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.lightIntensity'),
            showDelay: 300
          }"
          class="pi pi-sun text-white text-lg"
        />
      </Button>
      <div
        v-show="showLightIntensity"
        class="absolute left-12 top-0 bg-black bg-opacity-50 p-4 rounded-lg shadow-lg"
        style="width: 150px"
      >
        <Slider
          v-model="lightIntensity"
          class="w-full"
          :min="lightIntensityMinimum"
          :max="lightIntensityMaximum"
          :step="lightAdjustmentIncrement"
          @change="updateLightIntensity"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { t } from '@/i18n'
import { useSettingStore } from '@/stores/settingStore'

const vTooltip = Tooltip

const props = defineProps<{
  lightIntensity: number
  showLightIntensityButton: boolean
}>()

const emit = defineEmits<{
  (e: 'updateLightIntensity', value: number): void
}>()

const lightIntensity = ref(props.lightIntensity)
const showLightIntensityButton = ref(props.showLightIntensityButton)
const showLightIntensity = ref(false)

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

watch(
  () => props.showLightIntensityButton,
  (newValue) => {
    showLightIntensityButton.value = newValue
  }
)

const toggleLightIntensity = () => {
  showLightIntensity.value = !showLightIntensity.value
}

const updateLightIntensity = () => {
  emit('updateLightIntensity', lightIntensity.value)
}

const closeLightSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-light-intensity')) {
    showLightIntensity.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeLightSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeLightSlider)
})
</script>
