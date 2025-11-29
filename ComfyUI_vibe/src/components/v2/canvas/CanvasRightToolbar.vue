<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  orientation?: 'vertical' | 'horizontal'
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'vertical'
})

const emit = defineEmits<{
  fitView: []
  zoomIn: []
  zoomOut: []
}>()

// Tool mode: 'select' or 'pan'
const toolMode = ref<'select' | 'pan'>('select')

// Zoom level (percentage)
const zoomLevel = ref(75)

// Toggle states
const showMinimap = ref(false)
const showLinks = ref(true)

const isVertical = computed(() => props.orientation === 'vertical')
const tooltipPos = computed(() => isVertical.value ? 'left' : 'top')

function setToolMode(mode: 'select' | 'pan'): void {
  toolMode.value = mode
}

function handleFitView(): void {
  emit('fitView')
}

function handleZoomIn(): void {
  zoomLevel.value = Math.min(400, zoomLevel.value + 25)
  emit('zoomIn')
}

function handleZoomOut(): void {
  zoomLevel.value = Math.max(10, zoomLevel.value - 25)
  emit('zoomOut')
}

function toggleMinimap(): void {
  showMinimap.value = !showMinimap.value
}

function toggleLinks(): void {
  showLinks.value = !showLinks.value
}
</script>

<template>
  <div
    class="absolute z-10"
    :class="isVertical ? 'right-4 top-1/2 -translate-y-1/2' : 'bottom-4 right-4'"
  >
    <div
      class="flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/90 p-1.5 backdrop-blur"
      :class="isVertical ? 'flex-col' : 'flex-row'"
    >
      <!-- Select / Pan Toggle -->
      <button
        v-tooltip:[tooltipPos]="{ value: 'Select', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        :class="toolMode === 'select' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
        @click="setToolMode('select')"
      >
        <i class="pi pi-arrow-up-left text-base" />
      </button>
      <button
        v-tooltip:[tooltipPos]="{ value: 'Pan', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        :class="toolMode === 'pan' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
        @click="setToolMode('pan')"
      >
        <i class="pi pi-arrows-alt text-base" />
      </button>

      <!-- Divider -->
      <div :class="isVertical ? 'my-1 h-px w-5 bg-zinc-700' : 'mx-1 h-5 w-px bg-zinc-700'" />

      <!-- Fit to Screen -->
      <button
        v-tooltip:[tooltipPos]="{ value: 'Fit to Screen', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        @click="handleFitView"
      >
        <i class="pi pi-expand text-base" />
      </button>

      <!-- Divider -->
      <div :class="isVertical ? 'my-1 h-px w-5 bg-zinc-700' : 'mx-1 h-5 w-px bg-zinc-700'" />

      <!-- Zoom Controls -->
      <button
        v-tooltip:[tooltipPos]="{ value: 'Zoom In', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        @click="handleZoomIn"
      >
        <i class="pi pi-plus text-sm" />
      </button>
      <div
        v-tooltip:[tooltipPos]="{ value: 'Zoom Level', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center text-[10px] font-medium text-zinc-400"
      >
        {{ zoomLevel }}%
      </div>
      <button
        v-tooltip:[tooltipPos]="{ value: 'Zoom Out', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        @click="handleZoomOut"
      >
        <i class="pi pi-minus text-sm" />
      </button>

      <!-- Divider -->
      <div :class="isVertical ? 'my-1 h-px w-5 bg-zinc-700' : 'mx-1 h-5 w-px bg-zinc-700'" />

      <!-- Minimap Toggle -->
      <button
        v-tooltip:[tooltipPos]="{ value: showMinimap ? 'Hide Minimap' : 'Show Minimap', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        :class="showMinimap ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
        @click="toggleMinimap"
      >
        <i class="pi pi-map text-base" />
      </button>

      <!-- Links Toggle -->
      <button
        v-tooltip:[tooltipPos]="{ value: showLinks ? 'Hide Links' : 'Show Links', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        :class="showLinks ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
        @click="toggleLinks"
      >
        <i class="pi pi-link text-base" />
      </button>
    </div>
  </div>
</template>
