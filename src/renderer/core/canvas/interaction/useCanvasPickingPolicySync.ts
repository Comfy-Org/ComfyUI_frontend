import { onScopeDispose, watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useCommandPolicyStore } from '@/stores/commandPolicyStore'

import { acquireSelectOnlyPin, releaseSelectOnlyPin } from './selectOnlyPin'

export function useCanvasPickingPolicySync() {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const agentNodeSelectionStore = useAgentNodeSelectionStore()
  const commandPolicyStore = useCommandPolicyStore()
  const owner = Symbol('useCanvasPickingPolicySync')

  let pinnedCanvas: LGraphCanvas | undefined

  function releasePin() {
    if (!pinnedCanvas) return
    releaseSelectOnlyPin(pinnedCanvas, owner)
    pinnedCanvas = undefined
  }

  function pinSelectOnly(canvas: LGraphCanvas) {
    if (pinnedCanvas === canvas) return
    releasePin()
    acquireSelectOnlyPin(canvas, owner)
    pinnedCanvas = canvas
  }

  watch(
    [
      () => settingStore.get('Comfy.Graph.CanvasInfo'),
      () => canvasStore.canvas,
      () => agentNodeSelectionStore.isActive
    ],
    ([canvasInfoEnabled, canvas, picking]) => {
      commandPolicyStore.graphMutationsLocked = picking
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
