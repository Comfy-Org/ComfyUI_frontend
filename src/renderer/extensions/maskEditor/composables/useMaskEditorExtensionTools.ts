import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { inRange, once } from 'es-toolkit'

import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { useCoordinateTransform } from '@comfyorg/mask-editor/useCoordinateTransform'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { useMaskEditorExtensionStore } from '@/renderer/extensions/maskEditor/stores/maskEditorExtensionStore'
import type {
  MaskEditorMask,
  MaskEditorOverlayPoint,
  MaskEditorPointerEvent,
  MaskEditorTool
} from '@comfyorg/mask-editor/extensionTypes'

import { createMaskEditorToolSession } from './maskEditorToolSession'

const pointerPhases: Record<string, MaskEditorPointerEvent['phase']> = {
  pointerdown: 'down',
  pointermove: 'move',
  pointerup: 'up',
  pointercancel: 'cancel'
}

export function useMaskEditorExtensionTools() {
  const { t } = useI18n()
  const editor = useMaskEditorStore()
  const coordinateTransform = useCoordinateTransform()
  const registry = useMaskEditorExtensionStore()
  const points = shallowRef<readonly MaskEditorOverlayPoint[]>([])
  const active = shallowRef<{
    tool: MaskEditorTool
    runtime: ReturnType<typeof createMaskEditorToolSession>
  }>()

  function getDimensions() {
    const { imgCtx, imgCanvas, maskCtx, rgbCtx } = editor
    if (
      !imgCtx ||
      !imgCanvas?.width ||
      !imgCanvas.height ||
      !maskCtx ||
      !rgbCtx
    ) {
      return undefined
    }
    return editor.canvasHistory.dimensions
  }

  function readImage() {
    const dimensions = getDimensions()
    const { imgCtx } = editor
    if (!dimensions || !imgCtx) return undefined
    return {
      image: imgCtx.getImageData(0, 0, dimensions.width, dimensions.height),
      revision: editor.canvasHistory.revision
    }
  }

  function applyMask(mask: MaskEditorMask) {
    const { maskCtx, rgbCtx, imgCtx } = editor
    if (!maskCtx || !rgbCtx || !imgCtx) return
    const { width, height, data } = mask
    const pixels = maskCtx.createImageData(width, height)
    const { r, g, b } = editor.maskColor
    for (let pixel = 0; pixel < data.length; pixel++) {
      const offset = pixel * 4
      pixels.data[offset] = r
      pixels.data[offset + 1] = g
      pixels.data[offset + 2] = b
      pixels.data[offset + 3] = data[pixel]
    }
    const rgb = rgbCtx.getImageData(0, 0, width, height)
    const image = imgCtx.getImageData(0, 0, width, height)
    maskCtx.putImageData(pixels, 0, 0)
    editor.canvasHistory.saveState(pixels, rgb, image)
  }

  function deactivate() {
    const previous = active.value
    active.value = undefined
    previous?.runtime.dispose()
  }

  function activate(id: string) {
    if (active.value?.tool.id === id) return
    const tool = registry.tools.find((entry) => entry.id === id)
    if (!tool) return
    deactivate()
    const runtime = createMaskEditorToolSession(
      tool,
      {
        readImage,
        getDimensions,
        applyMask,
        getRevision: () => editor.canvasHistory.revision
      },
      (value) => {
        points.value = value
      },
      once((error: unknown) => {
        reportError(error, {
          errorType: 'failure_running_mask_editor_extension',
          surface: 'workspace'
        })
        useToast().error(t('maskEditor.toolFailed', { tool: tool.label }))
        if (
          active.value?.tool === tool &&
          active.value.runtime.context.signal.aborted
        )
          deactivate()
      })
    )
    if (runtime.context.signal.aborted) return
    active.value = { tool, runtime }
  }

  async function handlePointer(event: PointerEvent) {
    const current = active.value
    const canvas = editor.maskCanvas
    if (!current || !canvas || !editor.pointerZone || !editor.canvasContainer)
      return
    const { x, y } = coordinateTransform.screenToCanvas({
      x: event.offsetX,
      y: event.offsetY
    })
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    await current.runtime.pointer({
      phase: pointerPhases[event.type] ?? 'up',
      x,
      y,
      inBounds: inRange(x, 0, canvas.width) && inRange(y, 0, canvas.height),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      buttons: event.buttons,
      pressure: event.pressure,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    })
  }

  watch(
    () => editor.canvasHistory.revision,
    () => active.value?.runtime.documentChanged(),
    { flush: 'sync' }
  )
  watch(
    () => registry.tools,
    (tools) => {
      if (active.value && !tools.includes(active.value.tool)) deactivate()
    },
    { flush: 'sync' }
  )
  onScopeDispose(deactivate)

  return {
    tools: computed(() => registry.tools),
    active,
    points,
    activate,
    deactivate,
    isActive: () => active.value !== undefined,
    handlePointer
  }
}

export type MaskEditorExtensionTools = ReturnType<
  typeof useMaskEditorExtensionTools
>
