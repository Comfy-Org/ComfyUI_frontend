<template>
  <div class="flex flex-col">
    <div class="relative show-up-direction">
      <Button class="p-button-rounded p-button-text" @click="toggleUpDirection">
        <i
          v-tooltip.right="{
            value: t('load3d.upDirection'),
            showDelay: 300
          }"
          class="pi pi-arrow-up text-white text-lg"
        />
      </Button>
      <div
        v-show="showUpDirection"
        class="absolute left-12 top-0 bg-black/50 rounded-lg shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="direction in upDirections"
            :key="direction"
            class="p-button-text text-white"
            :class="{ 'bg-blue-500': upDirection === direction }"
            @click="selectUpDirection(direction)"
          >
            {{ direction.toUpperCase() }}
          </Button>
        </div>
      </div>
    </div>

    <div class="relative show-material-mode">
      <Button
        class="p-button-rounded p-button-text"
        @click="toggleMaterialMode"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.materialMode'),
            showDelay: 300
          }"
          class="pi pi-box text-white text-lg"
        />
      </Button>
      <div
        v-show="showMaterialMode"
        class="absolute left-12 top-0 bg-black/50 rounded-lg shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="mode in materialModes"
            :key="mode"
            class="p-button-text text-white whitespace-nowrap"
            :class="{ 'bg-blue-500': materialMode === mode }"
            @click="selectMaterialMode(mode)"
          >
            {{ formatMaterialMode(mode) }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type {
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'

const vTooltip = Tooltip

const materialMode = defineModel<MaterialMode>('materialMode')
const upDirection = defineModel<UpDirection>('upDirection')

const showUpDirection = ref(false)
const showMaterialMode = ref(false)

const upDirections: UpDirection[] = [
  'original',
  '-x',
  '+x',
  '-y',
  '+y',
  '-z',
  '+z'
]

const materialModes = computed(() => {
  const modes: MaterialMode[] = [
    'original',
    'normal',
    'wireframe'
    //'depth' disable for now
  ]

  return modes
})

const toggleUpDirection = () => {
  showUpDirection.value = !showUpDirection.value
  showMaterialMode.value = false
}

const selectUpDirection = (direction: UpDirection) => {
  upDirection.value = direction
  showUpDirection.value = false
}

const toggleMaterialMode = () => {
  showMaterialMode.value = !showMaterialMode.value
  showUpDirection.value = false
}

const selectMaterialMode = (mode: MaterialMode) => {
  materialMode.value = mode
  showMaterialMode.value = false
}

const formatMaterialMode = (mode: MaterialMode) => {
  return t(`load3d.materialModes.${mode}`)
}

const closeSceneSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-up-direction')) {
    showUpDirection.value = false
  }

  if (!target.closest('.show-material-mode')) {
    showMaterialMode.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeSceneSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSceneSlider)
})
</script>
