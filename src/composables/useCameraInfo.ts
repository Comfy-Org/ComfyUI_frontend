import { computed, ref, toRaw, toRef } from 'vue'
import type { MaybeRef } from 'vue'

import { useViewportNodeWiring } from '@/composables/useViewportNodeWiring'
import { CameraInfoViewport } from '@/extensions/core/cameraInfo/CameraInfoViewport'
import type { TransformGizmoMode } from '@/extensions/core/cameraInfo/CameraInfoViewport'
import { DEFAULT_CAMERA_INFO_STATE } from '@/extensions/core/cameraInfo/types'
import type { CameraInfoState } from '@/extensions/core/cameraInfo/types'
import {
  readStateFromWidgets,
  writeWidgetValue
} from '@/extensions/core/cameraInfo/widgetBridge'
import type { NodeWithWidgets } from '@/extensions/core/cameraInfo/widgetBridge'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'

const WIDGET_NAMES = [
  'mode',
  'camera_type',
  'target_x',
  'target_y',
  'target_z',
  'roll',
  'fov',
  'zoom',
  'mode.yaw',
  'mode.pitch',
  'mode.distance',
  'mode.position_x',
  'mode.position_y',
  'mode.position_z',
  'mode.quat_x',
  'mode.quat_y',
  'mode.quat_z',
  'mode.quat_w'
] as const

export function useCameraInfo(nodeRef: MaybeRef<LGraphNode | null>) {
  const node = toRef(nodeRef)
  const wiring = useViewportNodeWiring()
  let viewport: CameraInfoViewport | null = null

  const cameraState = ref<CameraInfoState>(DEFAULT_CAMERA_INFO_STATE)
  const mode = computed(() => cameraState.value.mode)

  const initialize = (container: HTMLElement): void => {
    const raw = toRaw(node.value)
    if (!raw) return
    if (viewport) cleanup()

    try {
      const initialState = readStateFromWidgets(raw as NodeWithWidgets)
      cameraState.value = initialState
      viewport = new CameraInfoViewport(container, initialState, {
        onHandleDrag: (fieldName, value) => {
          writeWidgetValue(raw as NodeWithWidgets, fieldName, value)
        }
      })
      wireWidgetsToOverlay(raw as NodeWithWidgets)
      wiring.wireNode(raw as LGraphNode, { viewport: () => viewport?.viewport })
    } catch (error) {
      console.error('Failed to initialize CameraInfoViewport:', error)
      cleanup()
      useToastStore().addAlert(
        t('toastMessages.failedToInitializeCameraInfoViewer')
      )
    }
  }

  const cleanup = (): void => {
    wiring.unwire()
    viewport?.remove()
    viewport = null
  }

  const handleMouseEnter = (): void => {
    viewport?.viewport.updateStatusMouseOnScene(true)
    viewport?.viewport.refreshViewport()
  }

  const handleMouseLeave = (): void => {
    viewport?.viewport.updateStatusMouseOnScene(false)
  }

  const setGizmosVisible = (on: boolean): void => {
    viewport?.setGizmosVisible(on)
  }

  const setTransformGizmoMode = (gizmoMode: TransformGizmoMode): void => {
    viewport?.setTransformGizmoMode(gizmoMode)
  }

  const setLookThrough = (on: boolean): void => {
    viewport?.setLookThrough(on)
  }

  function wireWidgetsToOverlay(target: NodeWithWidgets): void {
    wiring.wireWidgets(target, WIDGET_NAMES, (widget) => {
      if (widget.name === 'mode') wireWidgetsToOverlay(target)
      if (!viewport) return
      const state = readStateFromWidgets(target)
      cameraState.value = state
      viewport.applyState(state)
    })
  }

  return {
    initialize,
    cleanup,
    handleMouseEnter,
    handleMouseLeave,
    setGizmosVisible,
    setTransformGizmoMode,
    setLookThrough,
    mode
  }
}
