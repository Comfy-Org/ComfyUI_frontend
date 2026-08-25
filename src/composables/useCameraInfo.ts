import { isEqual } from 'es-toolkit'
import { computed, toRaw, toValue, watch } from 'vue'
import type { MaybeRef } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { CameraInfoViewport } from '@/extensions/core/cameraInfo/CameraInfoViewport'
import type { TransformGizmoMode } from '@/extensions/core/cameraInfo/CameraInfoViewport'
import {
  readCameraInfoState,
  writeCameraInfoValue
} from '@/extensions/core/cameraInfo/widgetBridge'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'

export function useCameraInfo(nodeRef: MaybeRef<LGraphNode | null>) {
  const node = computed(() => toValue(nodeRef))
  let viewport: CameraInfoViewport | null = null
  let wiredNode: LGraphNode | null = null
  let originalOnMouseEnter: LGraphNode['onMouseEnter']
  let originalOnMouseLeave: LGraphNode['onMouseLeave']

  const cameraState = computed(() => readCameraInfoState(toRaw(node.value)))
  const mode = computed(() => cameraState.value.mode)

  watch(cameraState, (state) => {
    if (!viewport || isEqual(state, viewport.overlay.getState())) return
    viewport.applyState(state)
  })

  const initialize = (container: HTMLElement): void => {
    const raw = toRaw(node.value)
    if (!raw || !container) return
    if (viewport) cleanup()

    try {
      viewport = new CameraInfoViewport(container, cameraState.value, {
        onHandleDrag: (fieldName, value) => {
          writeCameraInfoValue(toRaw(node.value), fieldName, value)
        }
      })
      wireNodeMouseStatus(raw)
    } catch (error) {
      console.error('Failed to initialize CameraInfoViewport:', error)
      cleanup()
      useToastStore().addAlert(
        t('toastMessages.failedToInitializeCameraInfoViewer')
      )
    }
  }

  const cleanup = (): void => {
    unwireNodeMouseStatus()
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

  function wireNodeMouseStatus(target: LGraphNode): void {
    wiredNode = target
    originalOnMouseEnter = target.onMouseEnter
    originalOnMouseLeave = target.onMouseLeave
    target.onMouseEnter = useChainCallback(target.onMouseEnter, () => {
      viewport?.viewport.updateStatusMouseOnNode(true)
      viewport?.viewport.refreshViewport()
    })
    target.onMouseLeave = useChainCallback(target.onMouseLeave, () => {
      viewport?.viewport.updateStatusMouseOnNode(false)
    })
  }

  function unwireNodeMouseStatus(): void {
    if (!wiredNode) return
    wiredNode.onMouseEnter = originalOnMouseEnter
    wiredNode.onMouseLeave = originalOnMouseLeave
    wiredNode = null
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
