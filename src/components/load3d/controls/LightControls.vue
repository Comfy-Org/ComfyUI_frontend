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
        class="absolute left-12 top-0 bg-black/50 p-4 rounded-lg shadow-lg"
        style="width: 150px"
      >
        <Slider
          v-model="lightIntensity"
          class="w-full"
          :min="lightIntensityMinimum"
          :max="lightIntensityMaximum"
          :step="lightAdjustmentIncrement"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { MaterialMode } from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'

const vTooltip = Tooltip

const lightIntensity = defineModel<number>('lightIntensity')
const materialMode = defineModel<MaterialMode>('materialMode')

const showLightIntensityButton = computed(
  () => materialMode.value === 'original'
)
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

const toggleLightIntensity = () => {
  showLightIntensity.value = !showLightIntensity.value
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
