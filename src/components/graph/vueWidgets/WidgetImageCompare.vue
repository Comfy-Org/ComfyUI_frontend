<template>
  <div class="flex flex-col gap-1">
    <div
      class="image-compare-container relative overflow-hidden rounded border border-gray-300 dark-theme:border-gray-600"
    >
      <div
        v-if="!beforeImage || !afterImage"
        class="p-4 text-center text-gray-500 dark-theme:text-gray-400"
      >
        Before and after images required
      </div>
      <div v-else class="relative">
        <!-- After image (base layer) -->
        <Image
          v-bind="filteredProps"
          :src="afterImage"
          class="w-full h-auto"
          :alt="afterAlt"
        />
        <!-- Before image (overlay layer) -->
        <div
          class="absolute top-0 left-0 h-full overflow-hidden"
          :style="{ width: `${sliderPosition}%` }"
        >
          <Image
            v-bind="filteredProps"
            :src="beforeImage"
            class="w-full h-auto"
            :alt="beforeAlt"
          />
        </div>
        <!-- Slider handle -->
        <div
          class="absolute top-0 h-full w-0.5 bg-white shadow-lg cursor-col-resize z-10"
          :style="{ left: `${sliderPosition}%` }"
          @mousedown="startDrag"
          @touchstart="startDrag"
        >
          <div
            class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center"
          >
            <div class="w-4 h-4 flex items-center justify-center">
              <div class="w-0.5 h-3 bg-gray-600 mr-0.5"></div>
              <div class="w-0.5 h-3 bg-gray-600"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Image from 'primevue/image'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  IMAGE_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

interface ImageCompareValue {
  before: string
  after: string
  beforeAlt?: string
  afterAlt?: string
  beforeLabel?: string
  afterLabel?: string
  showLabels?: boolean
  initialPosition?: number
}

// Image compare widgets typically don't have v-model, they display comparison
const props = defineProps<{
  widget: SimplifiedWidget<ImageCompareValue>
  readonly?: boolean
}>()

const sliderPosition = ref(50) // Default to 50% (middle)
const isDragging = ref(false)

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, IMAGE_EXCLUDED_PROPS)
)

const beforeImage = computed(() => {
  const value = props.widget.value
  return typeof value === 'string' ? value : value?.before
})

const afterImage = computed(() => {
  const value = props.widget.value
  return typeof value === 'string' ? value : value?.after
})

const beforeAlt = computed(
  () => props.widget.value?.beforeAlt || 'Before image'
)
const afterAlt = computed(() => props.widget.value?.afterAlt || 'After image')

onMounted(() => {
  if (props.widget.value?.initialPosition !== undefined) {
    sliderPosition.value = Math.max(
      0,
      Math.min(100, props.widget.value.initialPosition)
    )
  }
})

const startDrag = (event: MouseEvent | TouchEvent) => {
  if (props.readonly) return

  isDragging.value = true
  event.preventDefault()

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging.value) return
    updateSliderPosition(e)
  }

  const handleMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('touchmove', handleMouseMove)
    document.removeEventListener('touchend', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('touchmove', handleMouseMove)
  document.addEventListener('touchend', handleMouseUp)
}

const updateSliderPosition = (event: MouseEvent | TouchEvent) => {
  const container = (event.target as HTMLElement).closest(
    '.image-compare-container'
  )
  if (!container) return

  const rect = container.getBoundingClientRect()
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const x = clientX - rect.left
  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))

  sliderPosition.value = percentage
}

onUnmounted(() => {
  isDragging.value = false
})
</script>
