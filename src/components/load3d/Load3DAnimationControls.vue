<template>
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
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { ref } from 'vue'

const props = defineProps<{
  animations: Array<{ name: string; index: number }>
  playing: boolean
}>()

const emit = defineEmits<{
  (e: 'togglePlay', value: boolean): void
  (e: 'speedChange', value: number): void
  (e: 'animationChange', value: number): void
}>()

const animations = ref(props.animations)
const playing = ref(props.playing)
const selectedSpeed = ref(1)
const selectedAnimation = ref(0)

const speedOptions = [
  { name: '0.1x', value: 0.1 },
  { name: '0.5x', value: 0.5 },
  { name: '1x', value: 1 },
  { name: '1.5x', value: 1.5 },
  { name: '2x', value: 2 }
]

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
  playing
})
</script>

<style scoped>
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
