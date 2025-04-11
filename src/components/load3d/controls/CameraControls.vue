<template>
  <div class="flex flex-col">
    <Button class="p-button-rounded p-button-text" @click="switchCamera">
      <i
        v-tooltip.right="{
          value: t('load3d.switchCamera'),
          showDelay: 300
        }"
        :class="['pi', getCameraIcon, 'text-white text-lg']"
      />
    </Button>
    <div v-if="showFOVButton" class="relative show-fov">
      <Button class="p-button-rounded p-button-text" @click="toggleFOV">
        <i
          v-tooltip.right="{ value: t('load3d.fov'), showDelay: 300 }"
          class="pi pi-expand text-white text-lg"
        />
      </Button>
      <div
        v-show="showFOV"
        class="absolute left-12 top-0 bg-black bg-opacity-50 p-4 rounded-lg shadow-lg"
        style="width: 150px"
      >
        <Slider
          v-model="fov"
          class="w-full"
          :min="10"
          :max="150"
          :step="1"
          @change="updateFOV"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { CameraType } from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'

const vTooltip = Tooltip

const props = defineProps<{
  cameraType: CameraType
  fov: number
  showFOVButton: boolean
}>()

const emit = defineEmits<{
  (e: 'switchCamera'): void
  (e: 'updateFOV', value: number): void
}>()

const cameraType = ref(props.cameraType)
const fov = ref(props.fov)
const showFOVButton = ref(props.showFOVButton)
const showFOV = ref(false)

watch(
  () => props.fov,
  (newValue) => {
    fov.value = newValue
  }
)

watch(
  () => props.showFOVButton,
  (newValue) => {
    showFOVButton.value = newValue
  }
)

watch(
  () => props.cameraType,
  (newValue) => {
    cameraType.value = newValue
  }
)

const switchCamera = () => {
  emit('switchCamera')
}

const toggleFOV = () => {
  showFOV.value = !showFOV.value
}

const updateFOV = () => {
  emit('updateFOV', fov.value)
}

const getCameraIcon = computed(() => {
  return props.cameraType === 'perspective' ? 'pi-camera' : 'pi-camera'
})

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
