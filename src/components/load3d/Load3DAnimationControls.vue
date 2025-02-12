<template>
  <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
    <Load3DControls
      :backgroundColor="backgroundColor"
      :showGrid="showGrid"
      :showPreview="showPreview"
      :lightIntensity="lightIntensity"
      :showLightIntensityButton="showLightIntensityButton"
      :fov="fov"
      :showFOVButton="showFOVButton"
      :showPreviewButton="showPreviewButton"
      @toggleCamera="onToggleCamera"
      @toggleGrid="onToggleGrid"
      @togglePreview="onTogglePreview"
      @updateBackgroundColor="onUpdateBackgroundColor"
      @updateLightIntensity="onUpdateLightIntensity"
      @updateFOV="onUpdateFOV"
      ref="load3dControlsRef"
    />

    <div
      v-if="animations && animations.length > 0"
      class="absolute top-0 left-0 w-full flex justify-center pt-2 gap-2 items-center z-10"
    >
      <Button class="p-button-rounded p-button-text" @click="togglePlay">
        <i
          :class="[
            'pi',
            playing ? 'pi-pause' : 'pi-play',
            'text-white text-lg'
          ]"
        ></i>
      </Button>

      <Select
        v-model="selectedSpeed"
        :options="speedOptions"
        optionLabel="name"
        optionValue="value"
        @change="speedChange"
        class="w-24"
      />

      <Select
        v-model="selectedAnimation"
        :options="animations"
        optionLabel="name"
        optionValue="index"
        @change="animationChange"
        class="w-32"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { ref, watch } from 'vue'

import Load3DControls from '@/components/load3d/Load3DControls.vue'

const props = defineProps<{
  animations: Array<{ name: string; index: number }>
  playing: boolean
  backgroundColor: string
  showGrid: boolean
  showPreview: boolean
  lightIntensity: number
  showLightIntensityButton: boolean
  fov: number
  showFOVButton: boolean
  showPreviewButton: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleCamera'): void
  (e: 'toggleGrid', value: boolean): void
  (e: 'togglePreview', value: boolean): void
  (e: 'updateBackgroundColor', color: string): void
  (e: 'togglePlay', value: boolean): void
  (e: 'speedChange', value: number): void
  (e: 'animationChange', value: number): void
  (e: 'updateLightIntensity', value: number): void
  (e: 'updateFOV', value: number): void
}>()

const animations = ref(props.animations)
const playing = ref(props.playing)
const selectedSpeed = ref(1)
const selectedAnimation = ref(0)
const backgroundColor = ref(props.backgroundColor)
const showGrid = ref(props.showGrid)
const showPreview = ref(props.showPreview)
const lightIntensity = ref(props.lightIntensity)
const showLightIntensityButton = ref(props.showLightIntensityButton)
const fov = ref(props.fov)
const showFOVButton = ref(props.showFOVButton)
const showPreviewButton = ref(props.showPreviewButton)
const load3dControlsRef = ref(null)

const speedOptions = [
  { name: '0.1x', value: 0.1 },
  { name: '0.5x', value: 0.5 },
  { name: '1x', value: 1 },
  { name: '1.5x', value: 1.5 },
  { name: '2x', value: 2 }
]

watch(backgroundColor, (newValue) => {
  load3dControlsRef.value.backgroundColor = newValue
})

watch(showLightIntensityButton, (newValue) => {
  load3dControlsRef.value.showLightIntensityButton = newValue
})

watch(showFOVButton, (newValue) => {
  load3dControlsRef.value.showFOVButton = newValue
})

watch(showPreviewButton, (newValue) => {
  load3dControlsRef.value.showPreviewButton = newValue
})

const onToggleCamera = () => {
  emit('toggleCamera')
}
const onToggleGrid = (value: boolean) => emit('toggleGrid', value)
const onTogglePreview = (value: boolean) => {
  emit('togglePreview', value)
}
const onUpdateBackgroundColor = (color: string) =>
  emit('updateBackgroundColor', color)

const onUpdateLightIntensity = (lightIntensity: number) => {
  emit('updateLightIntensity', lightIntensity)
}

const onUpdateFOV = (fov: number) => {
  emit('updateFOV', fov)
}

const togglePlay = () => {
  playing.value = !playing.value
  emit('togglePlay', playing.value)
}

const speedChange = () => {
  emit('speedChange', selectedSpeed.value)
}

const animationChange = () => {
  emit('animationChange', selectedAnimation.value)
}

defineExpose({
  animations,
  selectedAnimation,
  playing,
  backgroundColor,
  showGrid,
  lightIntensity,
  showLightIntensityButton,
  fov,
  showFOVButton
})
</script>
