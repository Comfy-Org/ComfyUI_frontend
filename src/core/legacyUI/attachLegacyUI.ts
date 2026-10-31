import { useRunButtonTelemetry } from '@/composables/useRunButtonTelemetry'
import { app as comfyApp } from '@/scripts/app'
import type { ComfyApp } from '@/scripts/app'
import { ComfyUI } from '@/scripts/ui'
import { ComfyAppMenu } from '@/scripts/ui/menu/index'
import { $el } from '@/scripts/ui/utils'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const detachers = new WeakMap<ComfyApp, () => void>()

/**
 * Builds the legacy menu, dialogs, and placeholder body elements on an app,
 * replacing any earlier attachment. Returns a function that removes them.
 */
export function attachLegacyUI(target: ComfyApp = comfyApp): () => void {
  detachers.get(target)?.()

  target.ui = new ComfyUI(target, {
    resetView: () => useLitegraphService().resetView(),
    restoreOutputs: (outputs) => useNodeOutputStore().restoreOutputs(outputs),
    trackRunButton: (intent) => useRunButtonTelemetry().trackRunButton(intent),
    enterFocusMode: () => {
      useWorkspaceStore().focusMode = true
    }
  })
  target.bodyTop = $el('div.comfyui-body-top')
  target.bodyLeft = $el('div.comfyui-body-left')
  target.bodyRight = $el('div.comfyui-body-right')
  target.bodyBottom = $el('div.comfyui-body-bottom')
  target.canvasContainer = $el('div.graph-canvas-container')
  target.menu = new ComfyAppMenu()

  const { ui, menu } = target
  const detach = () => {
    if (detachers.get(target) !== detach) return
    detachers.delete(target)
    ui.dispose()
    menu.element.remove()
  }
  detachers.set(target, detach)
  return detach
}
