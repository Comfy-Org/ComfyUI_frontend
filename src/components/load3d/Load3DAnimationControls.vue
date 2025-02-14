<template>
  <div
    v-if="animations && animations.length > 0"
    class="absolute top-0 left-0 w-full flex justify-center pt-2 gap-2 items-center pointer-events-auto z-10"
  >
    <Button class="p-button-rounded p-button-text" @click="togglePlay">
      <i
        :class="['pi', playing ? 'pi-pause' : 'pi-play', 'text-white text-lg']"
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
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { ref, watch } from 'vue'

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

watch(
  () => props.animations,
  (newVal) => {
    animations.value = newVal
  }
)

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
</script>
