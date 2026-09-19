import { watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { resolvePickingPolicy } from '@/renderer/core/canvas/interaction/pickingPolicy'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

/**
 * Projects the agent picking mode and the CanvasInfo setting onto the
 * litegraph canvas, so `selectOnly` and `show_info` keep a single writer.
 */
export function useCanvasPickingPolicySync() {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const agentNodeSelectionStore = useAgentNodeSelectionStore()

  watch(
    [
      () => settingStore.get('Comfy.Graph.CanvasInfo'),
      () => canvasStore.canvas,
      () => agentNodeSelectionStore.isActive
    ],
    ([canvasInfoEnabled, canvas, picking]) => {
      if (!canvas) return
      const { suppressesCanvasInfo } = resolvePickingPolicy({
        readOnly: canvas.read_only,
        picking
      })
      // `selectOnly` is a projection of `agentNodeSelectionStore.isActive`.
      canvas.selectOnly = picking
      canvas.show_info = canvasInfoEnabled && !suppressesCanvasInfo
      canvas.draw(false, true)
    },
    { immediate: true, flush: 'sync' }
  )
}
