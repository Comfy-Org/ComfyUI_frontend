<template>
  <div class="controls-container">
    <Load3DControls
      :backgroundColor="backgroundColor"
      :showGrid="showGrid"
      @toggleCamera="onToggleCamera"
      @toggleGrid="onToggleGrid"
      @updateBackgroundColor="onUpdateBackgroundColor"
      ref="load3dControlsRef"
    />

    <div class="animation-controls" v-if="animations && animations.length > 0">
      <Button class="p-button-rounded p-button-text" @click="togglePlay">
        <i :class="['pi', playing ? 'pi-pause' : 'pi-play']"></i>
      </Button>

      <Select
        v-model="selectedSpeed"
        :options="speedOptions"
        optionLabel="name"
        optionValue="value"
        @change="speedChange"
        class="speed-dropdown"
      />

      <Select
        v-model="selectedAnimation"
        :options="animations"
        optionLabel="name"
        optionValue="index"
        @change="animationChange"
        class="animation-dropdown"
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
}>()

const emit = defineEmits<{
  (e: 'toggleCamera'): void
  (e: 'toggleGrid', value: boolean): void
  (e: 'updateBackgroundColor', color: string): void
  (e: 'togglePlay', value: boolean): void
  (e: 'speedChange', value: number): void
  (e: 'animationChange', value: number): void
}>()

const animations = ref(props.animations)
const playing = ref(props.playing)
const selectedSpeed = ref(1)
const selectedAnimation = ref(0)
const backgroundColor = ref(props.backgroundColor)
const showGrid = ref(props.showGrid)
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

const onToggleCamera = () => {
  emit('toggleCamera')
}
const onToggleGrid = (value: boolean) => emit('toggleGrid', value)
const onUpdateBackgroundColor = (color: string) =>
  emit('updateBackgroundColor', color)

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
  showGrid
})
</script>

<style scoped>
.controls-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.animation-controls {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  align-items: center;
  pointer-events: auto;
  z-index: 2;
}

.pi {
  color: white;
  font-size: 1.2rem;
}

.speed-dropdown {
  width: 5rem;
}

.animation-dropdown {
  width: 8rem;
}
</style>
