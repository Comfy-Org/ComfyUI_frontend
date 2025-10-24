<template>
  <div class="flex flex-col">
    <Button class="p-button-rounded p-button-text" @click="switchCamera">
      <i
        v-tooltip.right="{
          value: $t('load3d.switchCamera'),
          showDelay: 300
        }"
        :class="['pi', getCameraIcon, 'text-lg text-white']"
      />
    </Button>
    <div v-if="showFOVButton" class="show-fov relative">
      <Button class="p-button-rounded p-button-text" @click="toggleFOV">
        <i
          v-tooltip.right="{ value: $t('load3d.fov'), showDelay: 300 }"
          class="pi pi-expand text-lg text-white"
        />
      </Button>
      <div
        v-show="showFOV"
        class="absolute top-0 left-12 rounded-lg bg-black/50 p-4 shadow-lg"
        style="width: 150px"
      >
        <Slider v-model="fov" class="w-full" :min="10" :max="150" :step="1" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { CameraType } from '@/extensions/core/load3d/interfaces'

const showFOV = ref(false)

const cameraType = defineModel<CameraType>('cameraType')
const fov = defineModel<number>('fov')
const showFOVButton = computed(() => cameraType.value === 'perspective')
const getCameraIcon = computed(() => {
  return cameraType.value === 'perspective' ? 'pi-camera' : 'pi-camera'
})

const toggleFOV = () => {
  showFOV.value = !showFOV.value
}

const switchCamera = () => {
  cameraType.value =
    cameraType.value === 'perspective' ? 'orthographic' : 'perspective'
}

const closeCameraSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-fov')) {
    showFOV.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeCameraSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeCameraSlider)
})
</script>
