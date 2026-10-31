import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { once } from 'es-toolkit'

import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { useMaskEditorExtensionStore } from '@/renderer/extensions/maskEditor/stores/maskEditorExtensionStore'
import type {
  MaskEditorMask,
  MaskEditorOverlayPoint,
  MaskEditorTool
} from '@comfyorg/mask-editor/extensionTypes'

import { createMaskEditorToolSession } from './maskEditorToolSession'

export function useMaskEditorExtensionTools() {
  const editor = useMaskEditorStore()
  const registry = useMaskEditorExtensionStore()
  const points = shallowRef<readonly MaskEditorOverlayPoint[]>([])
  const active = shallowRef<{
    tool: MaskEditorTool
    runtime: ReturnType<typeof createMaskEditorToolSession>
  }>()

  function readImage() {
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
    return {
      image: imgCtx.getImageData(0, 0, imgCanvas.width, imgCanvas.height),
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
    if (!current || !canvas) return
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = ((event.clientX - rect.left) * canvas.width) / rect.width
    const y = ((event.clientY - rect.top) * canvas.height) / rect.height
    const phase =
      event.type === 'pointerdown'
        ? 'down'
        : event.type === 'pointermove'
          ? 'move'
          : event.type === 'pointercancel'
            ? 'cancel'
            : 'up'
    await current.runtime.pointer({
      phase,
      x,
      y,
      inBounds: x >= 0 && y >= 0 && x < canvas.width && y < canvas.height,
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
