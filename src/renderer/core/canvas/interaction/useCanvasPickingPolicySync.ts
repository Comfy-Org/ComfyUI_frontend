import { onScopeDispose, watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

interface PinnedCanvas {
  canvas: LGraphCanvas
  selectOnlyBeforePick: boolean
}

export function useCanvasPickingPolicySync() {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const agentNodeSelectionStore = useAgentNodeSelectionStore()

  let pinned: PinnedCanvas | undefined

  function releasePin() {
    if (!pinned) return
    pinned.canvas.selectOnly = pinned.selectOnlyBeforePick
    pinned = undefined
  }

  function pinSelectOnly(canvas: LGraphCanvas) {
    if (pinned?.canvas === canvas) return
    releasePin()
    pinned = { canvas, selectOnlyBeforePick: canvas.selectOnly }
    canvas.selectOnly = true
  }

  watch(
    [
      () => settingStore.get('Comfy.Graph.CanvasInfo'),
      () => canvasStore.canvas,
      () => agentNodeSelectionStore.isActive
    ],
    ([canvasInfoEnabled, canvas, picking]) => {
      if (picking && canvas) pinSelectOnly(canvas)
      else releasePin()
      if (!canvas) return
      canvas.show_info = canvasInfoEnabled && !picking
      canvas.draw(false, true)
    },
    { immediate: true, flush: 'sync' }
  )

  onScopeDispose(releasePin)
}
