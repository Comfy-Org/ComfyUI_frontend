<template>
  <div ref="container" class="w-full h-full relative comfy-load-3d">
    <LoadingOverlay ref="loadingOverlayRef" />
  </div>
</template>

<script setup lang="ts">
import { LGraphNode } from '@comfyorg/litegraph'
import { onMounted, onUnmounted, ref, toRaw, watch, watchEffect } from 'vue'

import LoadingOverlay from '@/components/load3d/LoadingOverlay.vue'
import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
import {
  CameraType,
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useLoad3dService } from '@/services/load3dService'

const props = defineProps<{
  node: LGraphNode
  inputSpec: CustomInputSpec
  backgroundColor: string
  showGrid: boolean
  lightIntensity: number
  fov: number
  cameraType: CameraType
  showPreview: boolean
  backgroundImage: string
  upDirection: UpDirection
  materialMode: MaterialMode
  edgeThreshold?: number
  extraListeners?: Record<string, (value: any) => void>
}>()

const container = ref<HTMLElement | null>(null)
const node = ref(props.node)
const load3d = ref<Load3d | Load3dAnimation | null>(null)
const loadingOverlayRef = ref<InstanceType<typeof LoadingOverlay> | null>(null)

const eventConfig = {
  materialModeChange: (value: string) => emit('materialModeChange', value),
  backgroundColorChange: (value: string) =>
    emit('backgroundColorChange', value),
  lightIntensityChange: (value: number) => emit('lightIntensityChange', value),
  fovChange: (value: number) => emit('fovChange', value),
  cameraTypeChange: (value: string) => emit('cameraTypeChange', value),
  showGridChange: (value: boolean) => emit('showGridChange', value),
  showPreviewChange: (value: boolean) => emit('showPreviewChange', value),
  backgroundImageChange: (value: string) =>
    emit('backgroundImageChange', value),
  backgroundImageLoadingStart: () =>
    loadingOverlayRef.value?.startLoading(t('load3d.loadingBackgroundImage')),
  backgroundImageLoadingEnd: () => loadingOverlayRef.value?.endLoading(),
  upDirectionChange: (value: string) => emit('upDirectionChange', value),
  edgeThresholdChange: (value: number) => emit('edgeThresholdChange', value),
  modelLoadingStart: () =>
    loadingOverlayRef.value?.startLoading(t('load3d.loadingModel')),
  modelLoadingEnd: () => loadingOverlayRef.value?.endLoading(),
  materialLoadingStart: () =>
    loadingOverlayRef.value?.startLoading(t('load3d.switchingMaterialMode')),
  materialLoadingEnd: () => loadingOverlayRef.value?.endLoading(),
  exportLoadingStart: (message: string) => {
    loadingOverlayRef.value?.startLoading(message || t('load3d.exportingModel'))
  },
  exportLoadingEnd: () => {
    loadingOverlayRef.value?.endLoading()
  },
  textureLoadingStart: () =>
    loadingOverlayRef.value?.startLoading(t('load3d.applyingTexture')),
  textureLoadingEnd: () => loadingOverlayRef.value?.endLoading(),
  recordingStatusChange: (value: boolean) =>
    emit('recordingStatusChange', value)
} as const

watchEffect(() => {
  if (load3d.value) {
    const rawLoad3d = toRaw(load3d.value) as Load3d

    rawLoad3d.setBackgroundColor(props.backgroundColor)
    rawLoad3d.toggleGrid(props.showGrid)
    rawLoad3d.setLightIntensity(props.lightIntensity)
    rawLoad3d.setFOV(props.fov)
    rawLoad3d.toggleCamera(props.cameraType)
    rawLoad3d.togglePreview(props.showPreview)
  }
})

watch(
  () => props.backgroundImage,
  async (newValue) => {
    if (load3d.value) {
      const rawLoad3d = toRaw(load3d.value) as Load3d

      await rawLoad3d.setBackgroundImage(newValue)
    }
  }
)

watch(
  () => props.upDirection,
  (newValue) => {
    if (load3d.value) {
      const rawLoad3d = toRaw(load3d.value) as Load3d

      rawLoad3d.setUpDirection(newValue)
    }
  }
)

watch(
  () => props.materialMode,
  (newValue) => {
    if (load3d.value) {
      const rawLoad3d = toRaw(load3d.value) as Load3d

      rawLoad3d.setMaterialMode(newValue)
    }
  }
)

watch(
  () => props.edgeThreshold,
  (newValue) => {
    if (load3d.value && newValue) {
      const rawLoad3d = toRaw(load3d.value) as Load3d

      rawLoad3d.setEdgeThreshold(newValue)
    }
  }
)

const emit = defineEmits<{
  (e: 'materialModeChange', materialMode: string): void
  (e: 'backgroundColorChange', color: string): void
  (e: 'lightIntensityChange', lightIntensity: number): void
  (e: 'fovChange', fov: number): void
  (e: 'cameraTypeChange', cameraType: string): void
  (e: 'showGridChange', showGrid: boolean): void
  (e: 'showPreviewChange', showPreview: boolean): void
  (e: 'backgroundImageChange', backgroundImage: string): void
  (e: 'upDirectionChange', upDirection: string): void
  (e: 'edgeThresholdChange', threshold: number): void
  (e: 'recordingStatusChange', status: boolean): void
}>()

const handleEvents = (action: 'add' | 'remove') => {
  if (!load3d.value) return

  Object.entries(eventConfig).forEach(([event, handler]) => {
    const method = `${action}EventListener` as const
    load3d.value?.[method](event, handler)
  })

  if (props.extraListeners) {
    Object.entries(props.extraListeners).forEach(([event, handler]) => {
      const method = `${action}EventListener` as const
      load3d.value?.[method](event, handler)
    })
  }
}

onMounted(() => {
  load3d.value = useLoad3dService().registerLoad3d(
    node.value as LGraphNode,
    // @ts-expect-error fixme ts strict error
    container.value,
    props.inputSpec
  )
  handleEvents('add')
})

onUnmounted(() => {
  handleEvents('remove')
  useLoad3dService().removeLoad3d(node.value as LGraphNode)
})

defineExpose({
  load3d
})
</script>
