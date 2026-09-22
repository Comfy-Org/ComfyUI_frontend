import { onScopeDispose, watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useCommandPolicyStore } from '@/stores/commandPolicyStore'

import { acquireSelectOnlyPin, releaseSelectOnlyPin } from './selectOnlyPin'

const graphMutationLockOwners = new Set<symbol>()

export function useCanvasPickingPolicySync() {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const agentNodeSelectionStore = useAgentNodeSelectionStore()
  const commandPolicyStore = useCommandPolicyStore()
  const owner = Symbol('useCanvasPickingPolicySync')

  let pinnedCanvas: LGraphCanvas | undefined

  function lockGraphMutations(locked: boolean) {
    if (locked) graphMutationLockOwners.add(owner)
    else graphMutationLockOwners.delete(owner)
    commandPolicyStore.graphMutationsLocked = graphMutationLockOwners.size > 0
  }

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
      lockGraphMutations(picking)
      if (picking && canvas) pinSelectOnly(canvas)
      else releasePin()
      if (!canvas) return
      canvas.show_info = canvasInfoEnabled && !picking
      canvas.draw(false, true)
    },
    { immediate: true, flush: 'sync' }
  )

  onScopeDispose(() => {
    lockGraphMutations(false)
    releasePin()
  })
}
