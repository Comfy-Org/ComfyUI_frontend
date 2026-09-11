import { computed, ref, toRaw, toRef, watch } from 'vue'
import type { MaybeRef } from 'vue'

import { useViewportNodeWiring } from '@/composables/useViewportNodeWiring'
import { CameraAngleViewport } from '@/extensions/core/cameraAngle/CameraAngleViewport'
import {
  clampState,
  describeCameraAngle,
  roundState
} from '@/extensions/core/cameraAngle/cameraAngleMath'
import {
  CAMERA_ANGLE_WIDGET_NAMES,
  DEFAULT_CAMERA_ANGLE_STATE
} from '@/extensions/core/cameraAngle/types'
import type {
  CameraAngleField,
  CameraAngleState,
  CameraAngleViewMode,
  SubjectFaceLabels
} from '@/extensions/core/cameraAngle/types'
import {
  readStateFromWidgets,
  readViewMode,
  writeStateToWidgets,
  writeViewMode
} from '@/extensions/core/cameraAngle/widgetBridge'
import type { NodeWithWidgets } from '@/extensions/core/cameraAngle/widgetBridge'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

const IMAGE_INPUT_NAME = 'image'
const WIDGET_NAMES = Object.values(CAMERA_ANGLE_WIDGET_NAMES)

export interface UseCameraAngleOptions {
  faceLabels?: () => SubjectFaceLabels
}

export function useCameraAngle(
  nodeRef: MaybeRef<LGraphNode | null>,
  options: UseCameraAngleOptions = {}
) {
  const node = toRef(nodeRef)
  const nodeOutputStore = useNodeOutputStore()
  const wiring = useViewportNodeWiring()
  let viewport: CameraAngleViewport | null = null
  let lastImageUrl: string | null = null

  const state = ref<CameraAngleState>(DEFAULT_CAMERA_ANGLE_STATE)
  const viewMode = ref<CameraAngleViewMode>('camera')
  const previewVisible = ref(false)
  const prompt = computed(() => describeCameraAngle(state.value))

  const rawNode = () => toRaw(node.value)

  const initialize = (container: HTMLElement): void => {
    const raw = rawNode()
    if (!raw) return
    if (viewport) cleanup()

    try {
      const target = raw as NodeWithWidgets
      state.value = readStateFromWidgets(target)
      viewMode.value = readViewMode(target)
      viewport = new CameraAngleViewport(container, state.value, {
        faceLabels: options.faceLabels?.(),
        onStateChange: (next) => {
          state.value = roundState(next)
          writeStateToWidgets(target, next)
        }
      })
      viewport.setViewMode(viewMode.value)
      viewport.setPreviewVisible(previewVisible.value)
      wiring.wireWidgets(target, WIDGET_NAMES, () => {
        if (!viewport) return
        state.value = readStateFromWidgets(target)
        viewport.applyState(state.value)
      })
      wiring.wireNode(raw as LGraphNode, {
        viewport: () => viewport?.viewport,
        onConnectionsChange: syncSubjectImage
      })
      syncSubjectImage()
    } catch (error) {
      console.error('Failed to initialize CameraAngleViewport:', error)
      cleanup()
      useToastStore().addAlert(
        t('toastMessages.failedToInitializeCameraAngleViewer')
      )
    }
  }

  const cleanup = (): void => {
    wiring.unwire()
    viewport?.remove()
    viewport = null
    lastImageUrl = null
  }

  const handleMouseEnter = (): void => {
    viewport?.viewport.updateStatusMouseOnScene(true)
    viewport?.viewport.refreshViewport()
  }

  const handleMouseLeave = (): void => {
    viewport?.viewport.updateStatusMouseOnScene(false)
  }

  const setViewMode = (mode: CameraAngleViewMode): void => {
    viewMode.value = mode
    const raw = rawNode()
    if (raw) writeViewMode(raw as NodeWithWidgets, mode)
    viewport?.setViewMode(mode)
  }

  const setPreviewVisible = (visible: boolean): void => {
    previewVisible.value = visible
    viewport?.setPreviewVisible(visible)
  }

  const setField = (field: CameraAngleField, value: number): void => {
    const next = clampState({ ...state.value, [field]: value })
    state.value = next
    const raw = rawNode()
    if (raw) writeStateToWidgets(raw as NodeWithWidgets, next)
    viewport?.applyState(next)
  }

  function subjectImageUrl(target: LGraphNode): string | null {
    const slot = target.findInputSlot(IMAGE_INPUT_NAME)
    const inputNode = slot >= 0 ? target.getInputNode(slot) : null
    if (!inputNode) return null
    return nodeOutputStore.getNodeImageUrls(inputNode)?.[0] ?? null
  }

  function syncSubjectImage(): void {
    const raw = rawNode()
    if (!raw || !viewport) return
    const url = subjectImageUrl(raw as LGraphNode)
    if (url === lastImageUrl) return
    lastImageUrl = url
    void viewport.setImage(url)
  }

  watch(() => nodeOutputStore.nodeOutputs, syncSubjectImage, { deep: true })
  watch(() => nodeOutputStore.nodePreviewImages, syncSubjectImage, {
    deep: true
  })

  return {
    initialize,
    cleanup,
    handleMouseEnter,
    handleMouseLeave,
    setViewMode,
    setPreviewVisible,
    setField,
    state,
    viewMode,
    previewVisible,
    prompt
  }
}
