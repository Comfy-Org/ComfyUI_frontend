<template>
  <div
    class="absolute top-12 left-2 flex flex-col pointer-events-auto z-20 bg-gray-700 bg-opacity-30 rounded-lg"
  >
    <div class="relative show-menu">
      <Button
        class="p-button-rounded p-button-text bg-opacity-30"
        @click="toggleMenu"
      >
        <i class="pi pi-bars text-white text-lg"></i>
      </Button>

      <div
        v-show="isMenuOpen"
        class="absolute left-12 top-0 bg-black bg-opacity-50 rounded-lg shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="(label, category) in categories"
            :key="category"
            class="p-button-text w-full flex items-center justify-start"
            :class="{ 'bg-gray-600': activeCategory === category }"
            @click="selectCategory(category)"
          >
            <i :class="getCategoryIcon(category)"></i>
            <span class="text-white">{{ t(label) }}</span>
          </Button>
        </div>
      </div>
    </div>

    <div v-show="activeCategory" class="bg-gray-700 bg-opacity-30 rounded-lg">
      <div v-if="activeCategory === 'scene'" class="flex flex-col">
        <Button
          class="p-button-rounded p-button-text"
          :class="{ 'p-button-outlined': showGrid }"
          @click="toggleGrid"
        >
          <i
            class="pi pi-table text-white text-lg"
            v-tooltip.right="{ value: t('load3d.showGrid'), showDelay: 300 }"
          ></i>
        </Button>

        <div v-if="!hasBackgroundImage">
          <Button
            class="p-button-rounded p-button-text"
            @click="openColorPicker"
          >
            <i
              class="pi pi-palette text-white text-lg"
              v-tooltip.right="{
                value: t('load3d.backgroundColor'),
                showDelay: 300
              }"
            ></i>
            <input
              type="color"
              ref="colorPickerRef"
              :value="backgroundColor"
              @input="
                updateBackgroundColor(($event.target as HTMLInputElement).value)
              "
              class="absolute opacity-0 w-0 h-0 p-0 m-0 pointer-events-none"
            />
          </Button>
        </div>

        <div v-if="!hasBackgroundImage">
          <Button
            class="p-button-rounded p-button-text"
            @click="openImagePicker"
          >
            <i
              class="pi pi-image text-white text-lg"
              v-tooltip.right="{
                value: t('load3d.uploadBackgroundImage'),
                showDelay: 300
              }"
            ></i>
            <input
              type="file"
              ref="imagePickerRef"
              accept="image/*"
              @change="uploadBackgroundImage"
              class="absolute opacity-0 w-0 h-0 p-0 m-0 pointer-events-none"
            />
          </Button>
        </div>

        <div v-if="hasBackgroundImage">
          <Button
            class="p-button-rounded p-button-text"
            @click="removeBackgroundImage"
          >
            <i
              class="pi pi-times text-white text-lg"
              v-tooltip.right="{
                value: t('load3d.removeBackgroundImage'),
                showDelay: 300
              }"
            ></i>
          </Button>
        </div>
      </div>

      <div v-if="activeCategory === 'model'" class="flex flex-col">
        <div class="relative show-up-direction">
          <Button
            class="p-button-rounded p-button-text"
            @click="toggleUpDirection"
          >
            <i
              class="pi pi-arrow-up text-white text-lg"
              v-tooltip.right="{
                value: t('load3d.upDirection'),
                showDelay: 300
              }"
            ></i>
          </Button>
          <div
            v-show="showUpDirection"
            class="absolute left-12 top-0 bg-black bg-opacity-50 rounded-lg shadow-lg"
          >
            <div class="flex flex-col">
              <Button
                v-for="direction in upDirections"
                :key="direction"
                class="p-button-text text-white"
                :class="{ 'bg-blue-500': upDirection === direction }"
                @click="selectUpDirection(direction)"
              >
                {{ formatOption(direction) }}
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
              class="pi pi-box text-white text-lg"
              v-tooltip.right="{
                value: t('load3d.materialMode'),
                showDelay: 300
              }"
            ></i>
          </Button>
          <div
            v-show="showMaterialMode"
            class="absolute left-12 top-0 bg-black bg-opacity-50 rounded-lg shadow-lg"
          >
            <div class="flex flex-col">
              <Button
                v-for="mode in materialModes"
                :key="mode"
                class="p-button-text text-white"
                :class="{ 'bg-blue-500': materialMode === mode }"
                @click="selectMaterialMode(mode)"
              >
                {{ formatMaterialMode(mode) }}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="activeCategory === 'camera'" class="flex flex-col">
        <Button class="p-button-rounded p-button-text" @click="switchCamera">
          <i
            :class="['pi', getCameraIcon, 'text-white text-lg']"
            v-tooltip.right="{
              value: t('load3d.switchCamera'),
              showDelay: 300
            }"
          ></i>
        </Button>
        <div class="relative show-fov" v-if="showFOVButton">
          <Button class="p-button-rounded p-button-text" @click="toggleFOV">
            <i
              class="pi pi-expand text-white text-lg"
              v-tooltip.right="{ value: t('load3d.fov'), showDelay: 300 }"
            ></i>
          </Button>
          <div
            v-show="showFOV"
            class="absolute left-12 top-0 bg-black bg-opacity-50 p-4 rounded-lg shadow-lg"
            style="width: 150px"
          >
            <Slider
              v-model="fov"
              class="w-full"
              @change="updateFOV"
              :min="10"
              :max="150"
              :step="1"
            />
          </div>
        </div>
      </div>

      <div v-if="activeCategory === 'light'" class="flex flex-col">
        <div
          class="relative show-light-intensity"
          v-if="showLightIntensityButton"
        >
          <Button
            class="p-button-rounded p-button-text"
            @click="toggleLightIntensity"
          >
            <i
              class="pi pi-sun text-white text-lg"
              v-tooltip.right="{
                value: t('load3d.lightIntensity'),
                showDelay: 300
              }"
            ></i>
          </Button>
          <div
            v-show="showLightIntensity"
            class="absolute left-12 top-0 bg-black bg-opacity-50 p-4 rounded-lg shadow-lg"
            style="width: 150px"
          >
            <Slider
              v-model="lightIntensity"
              class="w-full"
              @change="updateLightIntensity"
              :min="1"
              :max="20"
              :step="1"
            />
          </div>
        </div>
      </div>
    </div>
    <div v-if="showPreviewButton">
      <Button class="p-button-rounded p-button-text" @click="togglePreview">
        <i
          :class="[
            'pi',
            showPreview ? 'pi-eye' : 'pi-eye-slash',
            'text-white text-lg'
          ]"
          v-tooltip.right="{ value: t('load3d.previewOutput'), showDelay: 300 }"
        ></i>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import {
  CameraType,
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'

const vTooltip = Tooltip

const props = defineProps<{
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
  isAnimation: boolean
}>()

const isMenuOpen = ref(false)
const activeCategory = ref<'scene' | 'model' | 'camera' | 'light'>('scene')
const categories = {
  scene: 'load3d.scene',
  model: 'load3d.model',
  camera: 'load3d.camera',
  light: 'load3d.light'
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const selectCategory = (category: 'scene' | 'model' | 'camera' | 'light') => {
  activeCategory.value = category
  isMenuOpen.value = false
}

const getCategoryIcon = (category: string) => {
  const icons = {
    scene: 'pi pi-image',
    model: 'pi pi-box',
    camera: 'pi pi-camera',
    light: 'pi pi-sun'
  }
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
}>()

const backgroundColor = ref(props.backgroundColor)
const showGrid = ref(props.showGrid)
const showPreview = ref(props.showPreview)
const colorPickerRef = ref<HTMLInputElement | null>(null)
const lightIntensity = ref(props.lightIntensity)
const upDirection = ref(props.upDirection || 'original')
const materialMode = ref(props.materialMode || 'original')
const showLightIntensity = ref(false)
const showLightIntensityButton = ref(props.showLightIntensityButton)
const fov = ref(props.fov)
const showFOV = ref(false)
const showFOVButton = ref(props.showFOVButton)
const showPreviewButton = ref(props.showPreviewButton)
const hasBackgroundImage = ref(props.hasBackgroundImage)
const imagePickerRef = ref<HTMLInputElement | null>(null)
const showUpDirection = ref(false)
const upDirections: UpDirection[] = [
  'original',
  '-x',
  '+x',
  '-y',
  '+y',
  '-z',
  '+z'
]
const showMaterialMode = ref(false)

const materialModes = computed(() => {
  const modes: MaterialMode[] = [
    'original',
    'normal',
    'wireframe'
    //'depth' disable for now
  ]

  if (!props.isAnimation) {
    modes.push('lineart')
  }

  return modes
})

const notMaterialLineart = computed(() => {
  return props.materialMode !== 'lineart'
})

const switchCamera = () => {
  emit('switchCamera')
}

const toggleGrid = () => {
  showGrid.value = !showGrid.value
  emit('toggleGrid', showGrid.value)
}

const togglePreview = () => {
  showPreview.value = !showPreview.value
  emit('togglePreview', showPreview.value)
}

const updateBackgroundColor = (color: string) => {
  emit('updateBackgroundColor', color)
}

const openColorPicker = () => {
  colorPickerRef.value?.click()
}

const toggleLightIntensity = () => {
  showLightIntensity.value = !showLightIntensity.value
}

const updateLightIntensity = () => {
  emit('updateLightIntensity', lightIntensity.value)
}

const toggleFOV = () => {
  showFOV.value = !showFOV.value
}

const updateFOV = () => {
  emit('updateFOV', fov.value)
}

const toggleUpDirection = () => {
  showUpDirection.value = !showUpDirection.value
}

const selectUpDirection = (direction: UpDirection) => {
  upDirection.value = direction
  emit('updateUpDirection', direction)
}

const formatOption = (option: string) => {
  if (option === 'original') return 'Original'
  return option.toUpperCase()
}

const toggleMaterialMode = () => {
  showMaterialMode.value = !showMaterialMode.value
}

const selectMaterialMode = (mode: MaterialMode) => {
  materialMode.value = mode
  emit('updateMaterialMode', mode)
}

const formatMaterialMode = (mode: MaterialMode) => {
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

const closeSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-menu')) {
    isMenuOpen.value = false
  }

  if (!target.closest('.show-fov')) {
    showFOV.value = false
  }

  if (!target.closest('.show-light-intensity')) {
    showLightIntensity.value = false
  }

  if (!target.closest('.show-up-direction')) {
    showUpDirection.value = false
  }

  if (!target.closest('.show-material-mode')) {
    showMaterialMode.value = false
  }
}

const openImagePicker = () => {
  imagePickerRef.value?.click()
}

watch(
  () => props.upDirection,
  (newValue) => {
    if (newValue) {
      upDirection.value = newValue
    }
  }
)

const uploadBackgroundImage = (event: Event) => {
  const input = event.target as HTMLInputElement

  hasBackgroundImage.value = true

  if (input.files && input.files[0]) {
    emit('updateBackgroundImage', input.files[0])
  }
}

const removeBackgroundImage = () => {
  hasBackgroundImage.value = false

  emit('updateBackgroundImage', null)
}

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

onMounted(() => {
  document.addEventListener('click', closeSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSlider)
})

const getCameraIcon = computed(() => {
  return props.cameraType === 'perspective' ? 'pi-camera' : 'pi-camera'
})
</script>
