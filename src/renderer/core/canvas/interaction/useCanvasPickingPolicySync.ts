import { watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

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
      canvas.selectOnly = picking
      canvas.show_info = canvasInfoEnabled && !picking
      canvas.draw(false, true)
    },
    { immediate: true, flush: 'sync' }
  )
}
