<template>
  <div
    class="absolute top-12 left-2 flex flex-col pointer-events-auto z-20 bg-gray-700/30 rounded-lg"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @wheel.stop
  >
    <div class="relative show-menu">
      <Button class="p-button-rounded p-button-text" @click="toggleMenu">
        <i class="pi pi-bars text-white text-lg" />
      </Button>

      <div
        v-show="isMenuOpen"
        class="absolute left-12 top-0 bg-black/50 rounded-lg shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="category in availableCategories"
            :key="category"
            class="p-button-text w-full flex items-center justify-start"
            :class="{ 'bg-gray-600': activeCategory === category }"
            @click="selectCategory(category)"
          >
            <i :class="getCategoryIcon(category)" />
            <span class="text-white whitespace-nowrap">{{
              t(categoryLabels[category])
            }}</span>
          </Button>
        </div>
      </div>
    </div>

    <div v-show="activeCategory" class="bg-gray-700/30 rounded-lg">
      <SceneControls
        v-if="activeCategory === 'scene' && sceneConfig"
        ref="sceneControlsRef"
        v-model:show-grid="sceneConfig.showGrid"
        v-model:background-color="sceneConfig.backgroundColor"
        v-model:background-image="sceneConfig.backgroundImage"
        @update-background-image="handleBackgroundImageUpdate"
      />

      <ModelControls
        v-if="activeCategory === 'model' && modelConfig"
        ref="modelControlsRef"
        v-model:material-mode="modelConfig.materialMode"
        v-model:up-direction="modelConfig.upDirection"
      />

      <CameraControls
        v-if="activeCategory === 'camera' && cameraConfig"
        ref="cameraControlsRef"
        v-model:camera-type="cameraConfig.cameraType"
        v-model:fov="cameraConfig.fov"
      />

      <LightControls
        v-if="activeCategory === 'light' && lightConfig && modelConfig"
        ref="lightControlsRef"
        v-model:light-intensity="lightConfig.intensity"
        v-model:material-mode="modelConfig.materialMode"
      />

      <ExportControls
        v-if="activeCategory === 'export'"
        ref="exportControlsRef"
        @export-model="handleExportModel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import CameraControls from '@/components/load3d/controls/CameraControls.vue'
import ExportControls from '@/components/load3d/controls/ExportControls.vue'
import LightControls from '@/components/load3d/controls/LightControls.vue'
import ModelControls from '@/components/load3d/controls/ModelControls.vue'
import SceneControls from '@/components/load3d/controls/SceneControls.vue'
import type {
  CameraConfig,
  LightConfig,
  ModelConfig,
  SceneConfig
} from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'

const sceneConfig = defineModel<SceneConfig>('sceneConfig')
const modelConfig = defineModel<ModelConfig>('modelConfig')
const cameraConfig = defineModel<CameraConfig>('cameraConfig')
const lightConfig = defineModel<LightConfig>('lightConfig')

const isMenuOpen = ref(false)
const activeCategory = ref<string>('scene')
const categoryLabels: Record<string, string> = {
  scene: 'load3d.scene',
  model: 'load3d.model',
  camera: 'load3d.camera',
  light: 'load3d.light',
  export: 'load3d.export'
}

const availableCategories = computed(() => {
  return ['scene', 'model', 'camera', 'light', 'export']
})

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const selectCategory = (category: string) => {
  activeCategory.value = category
  isMenuOpen.value = false
}

const getCategoryIcon = (category: string) => {
  const icons = {
    scene: 'pi pi-image',
    model: 'pi pi-box',
    camera: 'pi pi-camera',
    light: 'pi pi-sun',
    export: 'pi pi-download'
  }
  // @ts-expect-error fixme ts strict error
  return `${icons[category]} text-white text-lg`
}

const emit = defineEmits<{
  (e: 'updateBackgroundImage', file: File | null): void
  (e: 'exportModel', format: string): void
}>()

const handleBackgroundImageUpdate = (file: File | null) => {
  emit('updateBackgroundImage', file)
}

const handleExportModel = (format: string) => {
  emit('exportModel', format)
}

const closeSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-menu')) {
    isMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSlider)
})
</script>
