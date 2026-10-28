<template>
  <div class="show-slider relative">
    <Button
      :tooltip="tooltipText"
      tooltip-side="right"
      size="icon"
      variant="textonly"
      class="rounded-full"
      :aria-label="tooltipText"
      @click="toggleSlider"
    >
      <i :class="cn(icon, 'size-4.5 text-foreground')" />
    </Button>
    <div
      v-show="showSlider"
      class="absolute top-0 left-12 w-[150px] rounded-lg bg-popover p-4 shadow-lg"
    >
      <Slider
        :model-value="sliderValue"
        :min="min"
        :max="max"
        :step="step"
        @update:model-value="onSliderUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Slider from '@comfyorg/design-system/slider/Slider'

const {
  icon = 'icon-[lucide--expand]',
  min = 10,
  max = 150,
  step = 1
} = defineProps<{
  icon?: string
  tooltipText: string
  min?: number
  max?: number
  step?: number
}>()

const value = defineModel<number>()
const showSlider = ref(false)

const sliderValue = computed(() => [value.value ?? min])

function onSliderUpdate(val: number[] | undefined) {
  if (val?.length) value.value = val[0]
}

const toggleSlider = () => {
  showSlider.value = !showSlider.value
}

const closeSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-slider')) {
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
