<template>
  <div
    class="pointer-events-auto absolute top-12 left-2 z-20 flex flex-col rounded-lg bg-backdrop/30"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @wheel.stop
  >
    <div class="relative">
      <Button
        ref="menuTriggerRef"
        variant="textonly"
        size="icon"
        :aria-label="$t('menu.showMenu')"
        class="rounded-full"
        @click="toggleMenu"
      >
        <i class="pi pi-bars text-lg text-base-foreground" />
      </Button>

      <div
        v-show="isMenuOpen"
        ref="menuPanelRef"
        class="absolute top-0 left-12 rounded-lg bg-interface-menu-surface shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="category in availableCategories"
            :key="category"
            variant="textonly"
            :class="
              cn(
                'flex w-full items-center justify-start',
                activeCategory === category && 'bg-button-active-surface'
              )
            "
            @click="selectCategory(category)"
          >
            <i :class="getCategoryIcon(category)" />
            <span class="whitespace-nowrap text-base-foreground">{{
              $t(categoryLabels[category])
            }}</span>
          </Button>
        </div>
      </div>
    </div>

    <div v-show="activeCategory" class="rounded-lg bg-smoke-700/30">
      <SceneControls
        v-if="showSceneControls"
        v-model:show-grid="sceneConfig!.showGrid"
        v-model:background-color="sceneConfig!.backgroundColor"
        v-model:background-image="sceneConfig!.backgroundImage"
        v-model:background-render-mode="sceneConfig!.backgroundRenderMode"
        v-model:fov="cameraConfig!.fov"
        @update-background-image="handleBackgroundImageUpdate"
      />

      <ModelControls
        v-if="showModelControls"
        v-model:material-mode="modelConfig!.materialMode"
        v-model:up-direction="modelConfig!.upDirection"
        v-model:show-skeleton="modelConfig!.showSkeleton"
        :hide-material-mode="isSplatModel"
        :is-ply-model="isPlyModel"
        :has-skeleton="hasSkeleton"
      />

      <CameraControls
        v-if="showCameraControls"
        v-model:camera-type="cameraConfig!.cameraType"
        v-model:fov="cameraConfig!.fov"
      />

      <HDRIControls
        v-if="showLightControls"
        v-model:hdri-config="lightConfig!.hdri"
        :hdri-supported="hdriSupported"
        @update-hdri-file="handleHDRIFileUpdate"
      />

      <LightControls
        v-if="showLightControls"
        v-model:light-intensity="lightConfig!.intensity"
        v-model:material-mode="modelConfig!.materialMode"
        :hdri-enabled="lightConfig?.hdri?.enabled ?? false"
      />

      <ExportControls
        v-if="showExportControls"
        @export-model="handleExportModel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import CameraControls from '@/components/load3d/controls/CameraControls.vue'
import { useDismissableOverlay } from '@/composables/useDismissableOverlay'
import ExportControls from '@/components/load3d/controls/ExportControls.vue'
import HDRIControls from '@/components/load3d/controls/HDRIControls.vue'
import LightControls from '@/components/load3d/controls/LightControls.vue'
import ModelControls from '@/components/load3d/controls/ModelControls.vue'
import SceneControls from '@/components/load3d/controls/SceneControls.vue'
import Button from '@/components/ui/button/Button.vue'
import type {
  CameraConfig,
  LightConfig,
  ModelConfig,
  SceneConfig
} from '@/extensions/core/load3d/interfaces'
import { cn } from '@/utils/tailwindUtil'

const {
  isSplatModel = false,
  isPlyModel = false,
  hasSkeleton = false,
  hdriSupported = false
} = defineProps<{
  isSplatModel?: boolean
  isPlyModel?: boolean
  hasSkeleton?: boolean
  hdriSupported?: boolean
}>()

const sceneConfig = defineModel<SceneConfig>('sceneConfig')
const modelConfig = defineModel<ModelConfig>('modelConfig')
const cameraConfig = defineModel<CameraConfig>('cameraConfig')
const lightConfig = defineModel<LightConfig>('lightConfig')

const isMenuOpen = ref(false)
const menuPanelRef = ref<HTMLElement | null>(null)
const menuTriggerRef = ref<InstanceType<typeof Button> | null>(null)

useDismissableOverlay({
  isOpen: isMenuOpen,
  getOverlayEl: () => menuPanelRef.value,
  getTriggerEl: () => menuTriggerRef.value?.$el ?? null,
  onDismiss: () => {
    isMenuOpen.value = false
  }
})
const activeCategory = ref<string>('scene')
const categoryLabels: Record<string, string> = {
  scene: 'load3d.scene',
  model: 'load3d.model',
  camera: 'load3d.camera',
  light: 'load3d.light',
  export: 'load3d.export'
}

const availableCategories = computed(() => {
  if (isSplatModel) {
    return ['scene', 'model', 'camera']
  }

  return ['scene', 'model', 'camera', 'light', 'export']
})

const showSceneControls = computed(
  () => activeCategory.value === 'scene' && !!sceneConfig.value
)
const showModelControls = computed(
  () => activeCategory.value === 'model' && !!modelConfig.value
)
const showCameraControls = computed(
  () => activeCategory.value === 'camera' && !!cameraConfig.value
)
const showLightControls = computed(
  () =>
    activeCategory.value === 'light' &&
    !!lightConfig.value &&
    !!modelConfig.value
)
const showExportControls = computed(() => activeCategory.value === 'export')

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
  return `${icons[category]} text-base-foreground text-lg`
}

const emit = defineEmits<{
  (e: 'updateBackgroundImage', file: File | null): void
  (e: 'exportModel', format: string): void
  (e: 'updateHdriFile', file: File | null): void
}>()

const handleBackgroundImageUpdate = (file: File | null) => {
  emit('updateBackgroundImage', file)
}

const handleExportModel = (format: string) => {
  emit('exportModel', format)
}

const handleHDRIFileUpdate = (file: File | null) => {
  emit('updateHdriFile', file)
}
</script>
