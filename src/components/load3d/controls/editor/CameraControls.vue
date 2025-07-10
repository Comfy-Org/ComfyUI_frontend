<template>
  <div class="space-y-4">
    <label>
      {{ t('load3d.editor.cameraType') }}
    </label>
    <Select
      v-model="cameraType"
      :options="cameras"
      option-label="title"
      option-value="value"
      @change="switchCamera"
    >
    </Select>
  </div>

  <div v-if="showFOVButton" class="space-y-4">
    <label>{{ t('load3d.fov') }}</label>
    <Slider
      v-model="fov"
      :min="10"
      :max="150"
      :step="1"
      aria-label="fov"
      @change="updateFOV"
    />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import Slider from 'primevue/slider'
import { ref, watch } from 'vue'

import { CameraType } from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'

const cameras = [
  { title: t('load3d.cameraType.perspective'), value: 'perspective' },
  { title: t('load3d.cameraType.orthographic'), value: 'orthographic' }
]

const props = defineProps<{
  cameraType: CameraType
  fov: number
  showFOVButton: boolean
}>()

const emit = defineEmits<{
  (e: 'switchCamera', value: CameraType): void
  (e: 'updateFOV', value: number): void
}>()

const cameraType = ref(props.cameraType)
const fov = ref(props.fov)
const showFOVButton = ref(props.showFOVButton)

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
  showFOVButton.value = cameraType.value === 'perspective'

  emit('switchCamera', cameraType.value)
}

const updateFOV = () => {
  emit('updateFOV', fov.value)
}
</script>
