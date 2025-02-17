<template>
  <div
    class="absolute top-2 left-2 flex flex-col gap-2 pointer-events-auto z-20"
  >
    <Button class="p-button-rounded p-button-text" @click="switchCamera">
      <i
        :class="['pi', getCameraIcon, 'text-white text-lg']"
        v-tooltip.right="{ value: t('load3d.switchCamera'), showDelay: 300 }"
      ></i>
    </Button>

    <Button
      class="p-button-rounded p-button-text"
      :class="{ 'p-button-outlined': showGrid }"
      @click="toggleGrid"
    >
      <i
        class="pi pi-table text-white text-lg"
        v-tooltip.right="{ value: t('load3d.showGrid'), showDelay: 300 }"
      ></i>
    </Button>

    <Button class="p-button-rounded p-button-text" @click="openColorPicker">
      <i
        class="pi pi-palette text-white text-lg"
        v-tooltip.right="{ value: t('load3d.backgroundColor'), showDelay: 300 }"
      ></i>
      <input
        type="color"
        ref="colorPickerRef"
        :value="backgroundColor"
        @input="
          updateBackgroundColor(($event.target as HTMLInputElement).value)
        "
        class="absolute opacity-0 w-0 h-0 p-0 m-0 pointer-events-none"
      />
    </Button>

    <div class="relative show-light-intensity" v-if="showLightIntensityButton">
      <Button
        class="p-button-rounded p-button-text"
        @click="toggleLightIntensity"
      >
        <i
          class="pi pi-sun text-white text-lg"
          v-tooltip.right="{
            value: t('load3d.lightIntensity'),
            showDelay: 300
          }"
        ></i>
      </Button>
      <div
        v-show="showLightIntensity"
        class="absolute left-12 top-0 bg-black bg-opacity-50 p-4 rounded-lg shadow-lg"
        style="width: 150px"
      >
        <Slider
          v-model="lightIntensity"
          class="w-full"
          @change="updateLightIntensity"
          :min="1"
          :max="20"
          :step="1"
        />
      </div>
    </div>

    <div class="relative show-fov" v-if="showFOVButton">
      <Button class="p-button-rounded p-button-text" @click="toggleFOV">
        <i
          class="pi pi-expand text-white text-lg"
          v-tooltip.right="{ value: t('load3d.fov'), showDelay: 300 }"
        ></i>
      </Button>
      <div
        v-show="showFOV"
        class="absolute left-12 top-0 bg-black bg-opacity-50 p-4 rounded-lg shadow-lg"
        style="width: 150px"
      >
        <Slider
          v-model="fov"
          class="w-full"
          @change="updateFOV"
          :min="10"
          :max="150"
          :step="1"
        />
      </div>
    </div>

    <div v-if="showPreviewButton">
      <Button class="p-button-rounded p-button-text" @click="togglePreview">
        <i
          :class="[
            'pi',
            showPreview ? 'pi-eye' : 'pi-eye-slash',
            'text-white text-lg'
          ]"
          v-tooltip.right="{ value: t('load3d.previewOutput'), showDelay: 300 }"
        ></i>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { t } from '@/i18n'

const vTooltip = Tooltip

const props = defineProps<{
  backgroundColor: string
  showGrid: boolean
  showPreview: boolean
  lightIntensity: number
  showLightIntensityButton: boolean
  fov: number
  showFOVButton: boolean
  showPreviewButton: boolean
  cameraType: 'perspective' | 'orthographic'
}>()

const emit = defineEmits<{
  (e: 'switchCamera'): void
  (e: 'toggleGrid', value: boolean): void
  (e: 'updateBackgroundColor', color: string): void
  (e: 'updateLightIntensity', value: number): void
  (e: 'updateFOV', value: number): void
  (e: 'togglePreview', value: boolean): void
}>()

const backgroundColor = ref(props.backgroundColor)
const showGrid = ref(props.showGrid)
const showPreview = ref(props.showPreview)
const colorPickerRef = ref<HTMLInputElement | null>(null)
const lightIntensity = ref(props.lightIntensity)
const showLightIntensity = ref(false)
const showLightIntensityButton = ref(props.showLightIntensityButton)
const fov = ref(props.fov)
const showFOV = ref(false)
const showFOVButton = ref(props.showFOVButton)
const showPreviewButton = ref(props.showPreviewButton)

const switchCamera = () => {
  emit('switchCamera')
}

const toggleGrid = () => {
  showGrid.value = !showGrid.value
  emit('toggleGrid', showGrid.value)
}

const togglePreview = () => {
  showPreview.value = !showPreview.value
  emit('togglePreview', showPreview.value)
}

const updateBackgroundColor = (color: string) => {
  emit('updateBackgroundColor', color)
}

const openColorPicker = () => {
  colorPickerRef.value?.click()
}

const toggleLightIntensity = () => {
  showLightIntensity.value = !showLightIntensity.value
}

const updateLightIntensity = () => {
  emit('updateLightIntensity', lightIntensity.value)
}

const toggleFOV = () => {
  showFOV.value = !showFOV.value
}

const updateFOV = () => {
  emit('updateFOV', fov.value)
}

const closeSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-fov')) {
    showFOV.value = false
  }

  if (!target.closest('.show-light-intensity')) {
    showLightIntensity.value = false
  }
}

watch(
  () => props.backgroundColor,
  (newValue) => {
    backgroundColor.value = newValue
  }
)

watch(
  () => props.fov,
  (newValue) => {
    fov.value = newValue
  }
)

watch(
  () => props.lightIntensity,
  (newValue) => {
    lightIntensity.value = newValue
  }
)

watch(
  () => props.showFOVButton,
  (newValue) => {
    showFOVButton.value = newValue
  }
)

watch(
  () => props.showLightIntensityButton,
  (newValue) => {
    showLightIntensityButton.value = newValue
  }
)

watch(
  () => props.showPreviewButton,
  (newValue) => {
    showPreviewButton.value = newValue
  }
)

watch(
  () => props.showPreview,
  (newValue) => {
    showPreview.value = newValue
  }
)

onMounted(() => {
  document.addEventListener('click', closeSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSlider)
})

const getCameraIcon = computed(() => {
  return props.cameraType === 'perspective' ? 'pi-camera' : 'pi-th-large'
})
</script>
