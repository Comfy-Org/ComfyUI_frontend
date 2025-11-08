<template>
  <div :class="containerClass" class="relative">
    <Button class="p-button-rounded p-button-text" @click="toggleSlider">
      <i
        v-tooltip.right="{ value: tooltipText, showDelay: 300 }"
        :class="['pi', icon, 'text-lg text-white']"
      />
    </Button>
    <div
      v-show="showSlider"
      class="absolute top-0 left-12 rounded-lg bg-black/50 p-4 shadow-lg"
      style="width: 150px"
    >
      <Slider
        v-model="value"
        class="w-full"
        :min="min"
        :max="max"
        :step="step"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { onMounted, onUnmounted, ref } from 'vue'

const {
  icon = 'pi-expand',
  min = 10,
  max = 150,
  step = 1,
  containerClass = 'show-slider'
} = defineProps<{
  icon?: string
  tooltipText: string
  min?: number
  max?: number
  step?: number
  containerClass?: string
}>()

const value = defineModel<number>()
const showSlider = ref(false)

const toggleSlider = () => {
  showSlider.value = !showSlider.value
}

const closeSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest(`.${containerClass}`)) {
    showSlider.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSlider)
})
</script>
