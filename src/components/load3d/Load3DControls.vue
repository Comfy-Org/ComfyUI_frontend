<template>
  <div
    class="absolute top-12 left-2 flex flex-col pointer-events-auto z-20 bg-gray-700 bg-opacity-30 rounded-lg"
  >
    <div class="relative show-menu">
      <Button
        class="p-button-rounded p-button-text bg-opacity-30"
        @click="toggleMenu"
      >
        <i class="pi pi-bars text-white text-lg" />
      </Button>

      <div
        v-show="isMenuOpen"
        class="absolute left-12 top-0 bg-black bg-opacity-50 rounded-lg shadow-lg"
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
            <span class="text-white">{{ t(categoryLabels[category]) }}</span>
          </Button>
        </div>
      </div>
    </div>

    <div v-show="activeCategory" class="bg-gray-700 bg-opacity-30 rounded-lg">
      <SceneControls
        v-if="activeCategory === 'scene'"
        ref="sceneControlsRef"
        :background-color="backgroundColor"
        :show-grid="showGrid"
        :has-background-image="hasBackgroundImage"
        @toggle-grid="handleToggleGrid"
        @update-background-color="handleBackgroundColorChange"
        @update-background-image="handleBackgroundImageUpdate"
      />

      <ModelControls
        v-if="activeCategory === 'model'"
        ref="modelControlsRef"
        :input-spec="inputSpec"
        :up-direction="upDirection"
        :material-mode="materialMode"
        :edge-threshold="edgeThreshold"
        @update-up-direction="handleUpdateUpDirection"
        @update-material-mode="handleUpdateMaterialMode"
        @update-edge-threshold="handleUpdateEdgeThreshold"
        @upload-texture="handleUploadTexture"
      />

      <CameraControls
        v-if="activeCategory === 'camera'"
        ref="cameraControlsRef"
        :camera-type="cameraType"
        :fov="fov"
        :show-f-o-v-button="showFOVButton"
        @switch-camera="switchCamera"
        @update-f-o-v="handleUpdateFOV"
      />

      <LightControls
        v-if="activeCategory === 'light'"
        ref="lightControlsRef"
        :light-intensity="lightIntensity"
        :show-light-intensity-button="showLightIntensityButton"
        @update-light-intensity="handleUpdateLightIntensity"
      />

      <ExportControls
        v-if="activeCategory === 'export'"
        ref="exportControlsRef"
        @export-model="handleExportModel"
      />
    </div>
    <div v-if="showPreviewButton">
      <Button class="p-button-rounded p-button-text" @click="togglePreview">
        <i
          v-tooltip.right="{ value: t('load3d.previewOutput'), showDelay: 300 }"
          :class="[
            'pi',
            showPreview ? 'pi-eye' : 'pi-eye-slash',
            'text-white text-lg'
          ]"
        />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import CameraControls from '@/components/load3d/controls/CameraControls.vue'
import ExportControls from '@/components/load3d/controls/ExportControls.vue'
import LightControls from '@/components/load3d/controls/LightControls.vue'
import ModelControls from '@/components/load3d/controls/ModelControls.vue'
import SceneControls from '@/components/load3d/controls/SceneControls.vue'
import {
  CameraType,
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

const vTooltip = Tooltip

const props = defineProps<{
  inputSpec: CustomInputSpec
  backgroundColor: string
  showGrid: boolean
  showPreview: boolean
  lightIntensity: number
  showLightIntensityButton: boolean
  fov: number
  showFOVButton: boolean
  showPreviewButton: boolean
  cameraType: CameraType
  hasBackgroundImage?: boolean
  upDirection: UpDirection
  materialMode: MaterialMode
  edgeThreshold?: number
}>()

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
  const baseCategories = ['scene', 'model', 'camera', 'light']

  if (!props.inputSpec.isAnimation) {
    return [...baseCategories, 'export']
  }

  return baseCategories
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
  (e: 'switchCamera'): void
  (e: 'toggleGrid', value: boolean): void
  (e: 'updateBackgroundColor', color: string): void
  (e: 'updateLightIntensity', value: number): void
  (e: 'updateFOV', value: number): void
  (e: 'togglePreview', value: boolean): void
  (e: 'updateBackgroundImage', file: File | null): void
  (e: 'updateUpDirection', direction: UpDirection): void
  (e: 'updateMaterialMode', mode: MaterialMode): void
  (e: 'updateEdgeThreshold', value: number): void
  (e: 'exportModel', format: string): void
  (e: 'uploadTexture', file: File): void
}>()

const backgroundColor = ref(props.backgroundColor)
const showGrid = ref(props.showGrid)
const showPreview = ref(props.showPreview)
const lightIntensity = ref(props.lightIntensity)
const upDirection = ref(props.upDirection || 'original')
const materialMode = ref(props.materialMode || 'original')
const showLightIntensityButton = ref(props.showLightIntensityButton)
const fov = ref(props.fov)
const showFOVButton = ref(props.showFOVButton)
const showPreviewButton = ref(props.showPreviewButton)
const hasBackgroundImage = ref(props.hasBackgroundImage)
const edgeThreshold = ref(props.edgeThreshold)

const switchCamera = () => {
  emit('switchCamera')
}

const togglePreview = () => {
  showPreview.value = !showPreview.value
  emit('togglePreview', showPreview.value)
}

const handleToggleGrid = (value: boolean) => {
  emit('toggleGrid', value)
}

const handleBackgroundColorChange = (value: string) => {
  emit('updateBackgroundColor', value)
}

const handleBackgroundImageUpdate = (file: File | null) => {
  emit('updateBackgroundImage', file)
}

const handleUpdateUpDirection = (direction: UpDirection) => {
  emit('updateUpDirection', direction)
}

const handleUpdateMaterialMode = (mode: MaterialMode) => {
  emit('updateMaterialMode', mode)
}

const handleUpdateEdgeThreshold = (value: number) => {
  emit('updateEdgeThreshold', value)
}

const handleUploadTexture = (file: File) => {
  emit('uploadTexture', file)
}

const handleUpdateLightIntensity = (value: number) => {
  emit('updateLightIntensity', value)
}

const handleUpdateFOV = (value: number) => {
  emit('updateFOV', value)
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

watch(
  () => props.upDirection,
  (newValue) => {
    if (newValue) {
      upDirection.value = newValue
    }
  }
)

watch(
  () => props.backgroundColor,
  (newValue) => {
    backgroundColor.value = newValue
  }
)

watch(
  () => props.fov,
  (newValue) => {
    fov.value = newValue
  }
)

watch(
  () => props.lightIntensity,
  (newValue) => {
    lightIntensity.value = newValue
  }
)

watch(
  () => props.showFOVButton,
  (newValue) => {
    showFOVButton.value = newValue
  }
)

watch(
  () => props.showLightIntensityButton,
  (newValue) => {
    showLightIntensityButton.value = newValue
  }
)

watch(
  () => props.upDirection,
  (newValue) => {
    upDirection.value = newValue
  }
)

watch(
  () => props.materialMode,
  (newValue) => {
    materialMode.value = newValue
  }
)

watch(
  () => props.showPreviewButton,
  (newValue) => {
    showPreviewButton.value = newValue
  }
)

watch(
  () => props.showPreview,
  (newValue) => {
    showPreview.value = newValue
  }
)

watch(
  () => props.hasBackgroundImage,
  (newValue) => {
    hasBackgroundImage.value = newValue
  }
)

watch(
  () => props.materialMode,
  (newValue) => {
    if (newValue) {
      materialMode.value = newValue
    }
  }
)

watch(
  () => props.edgeThreshold,
  (newValue) => {
    edgeThreshold.value = newValue
  }
)

onMounted(() => {
  document.addEventListener('click', closeSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSlider)
})
</script>
