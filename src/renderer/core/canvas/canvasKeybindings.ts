import { t } from '@/i18n'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { AutoPanController } from '@/renderer/core/canvas/useAutoPan'

import { useRuntimeKeybindingStore } from '@/platform/keybindings/runtimeKeybindingStore'

const registrations = new WeakMap<LGraphCanvas, () => void>()

export function registerCanvasKeybindings(
  canvas: LGraphCanvas,
  getAutoPan: () => AutoPanController | null
) {
  unregisterCanvasKeybindings(canvas)
  const runtime = useRuntimeKeybindingStore()
  const disposers: (() => void)[] = []
  const isActive = () => !!canvas.graph && canvas.canvas.isConnected
  const isFocused = () =>
    isActive() &&
    (canvas.pointer.isDown ||
      canvas.canvas.parentElement?.contains(document.activeElement) === true)
  let panState: { readOnly: boolean; draggingCanvas: boolean } | undefined

  disposers.push(
    runtime.register({
      id: 'Comfy.Canvas.Pan',
      label: () => t('keybindings.canvasPan'),
      binding: {
        combo: { key: ' ' },
        targetElementId: 'graph-canvas-container'
      },
      enabled: isFocused,
      run: () => {
        panState ??= {
          readOnly: canvas.read_only,
          draggingCanvas: canvas.dragging_canvas
        }
        canvas.read_only = true
        getAutoPan()?.stop()
        canvas.dragging_canvas =
          canvas.pointer.isDown || !!canvas.linkConnector.renderLinks.length
      },
      release: () => {
        if (!panState) return
        canvas.read_only = panState.readOnly
        canvas.dragging_canvas =
          panState.draggingCanvas && canvas.pointer.isDown
        panState = undefined
        if (
          canvas.pointer.isDown &&
          (canvas.isDragging || canvas.linkConnector.isConnecting)
        ) {
          getAutoPan()?.updatePointer(canvas.mouse[0], canvas.mouse[1])
          getAutoPan()?.start()
        }
      }
    })
  )
  for (const key of ['Escape', 'Delete', 'Backspace']) {
    disposers.push(
      runtime.register({
        id: 'Comfy.Canvas.CancelGhostPlacement',
        label: () => t('keybindings.cancelGhostPlacement'),
        binding: { combo: { key } },
        enabled: () => isActive() && canvas.state.ghostNodeId != null,
        run: () => canvas.finalizeGhostPlacement(true)
      })
    )
  }
  disposers.push(
    runtime.register({
      id: 'Comfy.Canvas.CancelLink',
      label: () => t('keybindings.cancelLink'),
      binding: { combo: { key: 'Escape' } },
      enabled: () => isActive() && canvas.linkConnector.isConnecting,
      run: () => canvas.linkConnector.reset()
    })
  )
  disposers.push(
    runtime.register({
      id: 'Comfy.Canvas.ClosePanel',
      label: () => t('keybindings.closeCanvasPanel'),
      binding: { combo: { key: 'Escape' } },
      enabled: () =>
        isActive() && !!(canvas.node_panel || canvas.options_panel),
      run: () => {
        canvas.node_panel?.close()
        canvas.options_panel?.close()
      }
    })
  )

  const imageNodes = () =>
    Object.values(canvas.selected_nodes).filter(
      (node) =>
        !node.flags.collapsed &&
        !!node.imgs?.length &&
        typeof node.imageIndex === 'number'
    )
  for (const { key, id, label, delta } of [
    {
      key: 'Escape',
      id: 'CloseImage',
      label: 'keybindings.closeCanvasImage',
      delta: 0
    },
    {
      key: 'ArrowLeft',
      id: 'PreviousImage',
      label: 'keybindings.previousCanvasImage',
      delta: -1
    },
    {
      key: 'ArrowRight',
      id: 'NextImage',
      label: 'keybindings.nextCanvasImage',
      delta: 1
    }
  ]) {
    disposers.push(
      runtime.register({
        id: `Comfy.Canvas.${id}`,
        label: () => t(label),
        binding: {
          combo: { key },
          targetElementId: 'graph-canvas-container',
          allowRepeat: delta !== 0
        },
        enabled: () => isFocused() && imageNodes().length > 0,
        run: () => {
          for (const node of imageNodes()) {
            if (typeof node.imageIndex !== 'number' || !node.imgs?.length)
              continue
            node.imageIndex =
              delta === 0
                ? null
                : (node.imageIndex + delta + node.imgs.length) %
                  node.imgs.length
          }
          canvas.setDirty(true, true)
        }
      })
    )
  }
  registrations.set(canvas, () => {
    for (const dispose of disposers) dispose()
  })
}

export function unregisterCanvasKeybindings(canvas: LGraphCanvas) {
  registrations.get(canvas)?.()
  registrations.delete(canvas)
}
