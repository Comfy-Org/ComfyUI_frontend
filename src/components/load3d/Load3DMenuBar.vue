<template>
  <div class="pointer-events-none absolute inset-0 flex flex-col">
    <div
      ref="topBarRef"
      class="pointer-events-auto flex h-10 items-center gap-1 bg-interface-menu-surface px-2"
      @wheel.stop
    >
      <Popover v-model:open="catMenuOpen">
        <PopoverTrigger as-child>
          <button
            :class="chipClass"
            type="button"
            data-testid="load3d-category-menu"
          >
            {{ activeLabel }}
            <i class="icon-[lucide--chevron-down] size-4 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          :side-offset="8"
          :class="panelClass"
        >
          <button
            v-for="c in categoryDefs"
            :key="c.key"
            type="button"
            :class="
              cn(
                rowClass,
                activeCategory === c.key && 'bg-button-active-surface'
              )
            "
            @click="selectCategory(c.key)"
          >
            {{ c.label }}
          </button>
        </PopoverContent>
      </Popover>

      <div class="mx-1 h-5 w-px shrink-0 bg-interface-menu-stroke" />

      <SceneMenuGroup
        v-if="activeCategory === 'scene' && sceneConfig"
        v-model:config="sceneConfig"
        v-model:fov="cameraFov"
        :compact
        :can-use-background-image="canUseBackgroundImage"
        :hdri-active="hdriActive"
        @update-background-image="emit('updateBackgroundImage', $event)"
      />
      <ModelMenuGroup
        v-else-if="activeCategory === 'model' && modelConfig"
        v-model:config="modelConfig"
        :compact
        :material-modes="materialModes"
        :has-skeleton="hasSkeleton"
      />
      <CameraMenuGroup
        v-else-if="activeCategory === 'camera' && cameraConfig"
        v-model:config="cameraConfig"
        :compact
      />
      <LightMenuGroup
        v-else-if="activeCategory === 'light' && lightConfig && modelConfig"
        v-model:config="lightConfig"
        :compact
        :is-original-material="isOriginalMaterial"
      />
      <HdriMenuGroup
        v-else-if="activeCategory === 'hdri' && lightConfig"
        v-model:config="lightConfig"
        :compact
        :scene-has-image="sceneHasImage"
        @update-hdri-file="emit('updateHdriFile', $event)"
      />
      <GizmoMenuGroup
        v-else-if="activeCategory === 'gizmo' && modelConfig"
        v-model:config="modelConfig"
        :compact
        @toggle-gizmo="emit('toggleGizmo', $event)"
        @set-gizmo-mode="emit('setGizmoMode', $event)"
        @reset-gizmo-transform="emit('resetGizmoTransform')"
      />
    </div>

    <div
      :class="
        cn('flex-1', isRecording && 'border-2 border-node-component-executing')
      "
    />

    <div
      class="pointer-events-auto flex h-10 items-center justify-between gap-1 bg-interface-menu-surface px-2"
      @wheel.stop
    >
      <div class="flex items-center gap-1">
        <RecordMenuControl
          v-if="canUseRecording"
          v-model:is-recording="isRecording"
          v-model:has-recording="hasRecording"
          v-model:recording-duration="recordingDuration"
          :compact
          @start-recording="emit('startRecording')"
          @stop-recording="emit('stopRecording')"
          @export-recording="emit('exportRecording')"
          @clear-recording="emit('clearRecording')"
        />
      </div>
      <div class="flex items-center gap-1">
        <ViewerControls
          v-if="enableViewer && node"
          :node="node as LGraphNode"
        />
        <button
          v-if="canFitToViewer"
          v-tooltip.top="tip(t('load3d.fitToViewer'))"
          :class="iconBtnClass"
          type="button"
          :aria-label="t('load3d.fitToViewer')"
          @click="emit('fitToViewer')"
        >
          <i class="icon-[lucide--scan] size-4" />
        </button>
        <button
          v-if="canCenterCameraOnModel"
          v-tooltip.top="tip(t('load3d.centerCameraOnModel'))"
          :class="iconBtnClass"
          type="button"
          :aria-label="t('load3d.centerCameraOnModel')"
          @click="emit('centerCamera')"
        >
          <i class="icon-[lucide--crosshair] size-4" />
        </button>
        <Popover v-if="canExport" v-model:open="exportOpen">
          <PopoverTrigger as-child>
            <button
              v-tooltip.top="tip(t('load3d.export'))"
              :class="iconBtnClass"
              type="button"
              :aria-label="t('load3d.export')"
            >
              <i class="icon-[lucide--download] size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            :side-offset="8"
            :class="panelClass"
          >
            <button
              v-for="format in exportFormats"
              :key="format.value"
              type="button"
              :class="rowClass"
              @click="onExport(format.value)"
            >
              {{ format.label }}
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CameraMenuGroup from '@/components/load3d/menubar/CameraMenuGroup.vue'
import GizmoMenuGroup from '@/components/load3d/menubar/GizmoMenuGroup.vue'
import HdriMenuGroup from '@/components/load3d/menubar/HdriMenuGroup.vue'
import LightMenuGroup from '@/components/load3d/menubar/LightMenuGroup.vue'
import {
  chipClass,
  iconBtnClass,
  panelClass,
  rowClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import ModelMenuGroup from '@/components/load3d/menubar/ModelMenuGroup.vue'
import RecordMenuControl from '@/components/load3d/menubar/RecordMenuControl.vue'
import SceneMenuGroup from '@/components/load3d/menubar/SceneMenuGroup.vue'
import ViewerControls from '@/components/load3d/controls/ViewerControls.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { getExportFormatOptions } from '@/extensions/core/load3d/constants'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  CameraConfig,
  GizmoMode,
  LightConfig,
  MaterialMode,
  ModelConfig,
  SceneConfig
} from '@/extensions/core/load3d/interfaces'
import { cn } from '@comfyorg/tailwind-utils'

const {
  canUseLighting = true,
  canUseHdri = true,
  canUseGizmo = true,
  canExport = true,
  canUseBackgroundImage = true,
  canFitToViewer = true,
  canCenterCameraOnModel = true,
  canUseRecording = true,
  enableViewer = false,
  node = null,
  materialModes = ['original', 'clay', 'normal', 'wireframe'],
  hasSkeleton = false,
  sourceFormat = null
} = defineProps<{
  canUseLighting?: boolean
  canUseHdri?: boolean
  canUseGizmo?: boolean
  canExport?: boolean
  canUseBackgroundImage?: boolean
  canFitToViewer?: boolean
  canCenterCameraOnModel?: boolean
  canUseRecording?: boolean
  enableViewer?: boolean
  node?: LGraphNode | null
  materialModes?: readonly MaterialMode[]
  hasSkeleton?: boolean
  sourceFormat?: string | null
}>()

const sceneConfig = defineModel<SceneConfig>('sceneConfig')
const modelConfig = defineModel<ModelConfig>('modelConfig')
const cameraConfig = defineModel<CameraConfig>('cameraConfig')
const lightConfig = defineModel<LightConfig>('lightConfig')
const isRecording = defineModel<boolean>('isRecording')
const hasRecording = defineModel<boolean>('hasRecording')
const recordingDuration = defineModel<number>('recordingDuration')

const emit = defineEmits<{
  (e: 'updateBackgroundImage', file: File | null): void
  (e: 'updateHdriFile', file: File | null): void
  (e: 'exportModel', format: string): void
  (e: 'fitToViewer'): void
  (e: 'centerCamera'): void
  (e: 'toggleGizmo', enabled: boolean): void
  (e: 'setGizmoMode', mode: GizmoMode): void
  (e: 'resetGizmoTransform'): void
  (e: 'startRecording'): void
  (e: 'stopRecording'): void
  (e: 'exportRecording'): void
  (e: 'clearRecording'): void
}>()

const { t } = useI18n()

const categoryDefs = computed(() =>
  [
    { key: 'scene', label: t('load3d.scene'), show: !!sceneConfig.value },
    {
      key: 'model',
      label: t('load3d.model3d'),
      show: !!modelConfig.value
    },
    { key: 'camera', label: t('load3d.camera'), show: !!cameraConfig.value },
    {
      key: 'light',
      label: t('load3d.light'),
      show: canUseLighting && !!lightConfig.value && !!modelConfig.value
    },
    {
      key: 'hdri',
      label: t('load3d.hdri.label'),
      show: canUseHdri && !!lightConfig.value
    },
    {
      key: 'gizmo',
      label: t('load3d.gizmo.label'),
      show: canUseGizmo && !!modelConfig.value
    }
  ].filter((c) => c.show)
)

const activeCategory = ref('scene')
const activeLabel = computed(
  () =>
    categoryDefs.value.find((c) => c.key === activeCategory.value)?.label ?? ''
)
watch(categoryDefs, (defs) => {
  if (!defs.some((c) => c.key === activeCategory.value)) {
    activeCategory.value = defs[0]?.key ?? 'scene'
  }
})

const catMenuOpen = ref(false)
const exportOpen = ref(false)

const sceneHasImage = computed(
  () =>
    !!sceneConfig.value?.backgroundImage &&
    sceneConfig.value.backgroundImage !== ''
)
const hdriActive = computed(
  () =>
    !!lightConfig.value?.hdri?.hdriPath && !!lightConfig.value?.hdri?.enabled
)
const isOriginalMaterial = computed(
  () => modelConfig.value?.materialMode === 'original'
)
const cameraFov = computed({
  get: () => cameraConfig.value?.fov ?? 0,
  set: (value) => {
    if (cameraConfig.value) cameraConfig.value.fov = value
  }
})

const exportFormats = computed(() => getExportFormatOptions(sourceFormat))

const topBarRef = ref<HTMLElement | null>(null)
const { width: topW } = useElementSize(topBarRef)
const compactWidthThreshold = 480
const compact = computed(
  () => topW.value > 0 && topW.value < compactWidthThreshold
)

function selectCategory(key: string) {
  activeCategory.value = key
  catMenuOpen.value = false
}

function onExport(format: string) {
  emit('exportModel', format)
  exportOpen.value = false
}
</script>
