import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { withGraphEdit } from '@/lib/litegraph/src/graphEdits'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

export function useSelectedNodeActions() {
  const { getSelectedNodes, toggleSelectedNodesMode } =
    useSelectedLiteGraphItems()
  const commandStore = useCommandStore()

  const adjustNodeSize = () => {
    const canvas = app.canvas
    const selectedNodes = getSelectedNodes()

    withGraphEdit(canvas.graph, () => {
      selectedNodes.forEach((node) => {
        const optimalSize = node.computeSize()
        node.setSize([optimalSize[0], optimalSize[1]])
      })

      canvas.setDirty(true, true)
    })
  }

  const toggleNodeCollapse = () => {
    const canvas = app.canvas
    const selectedNodes = getSelectedNodes()
    withGraphEdit(canvas.graph, () => {
      selectedNodes.forEach((node) => {
        node.collapse()
      })

      canvas.setDirty(true, true)
    })
  }

  const toggleNodePin = () => {
    const canvas = app.canvas
    const selectedNodes = getSelectedNodes()
    withGraphEdit(canvas.graph, () => {
      selectedNodes.forEach((node) => {
        node.pin(!node.pinned)
      })

      canvas.setDirty(true, true)
    })
  }

  const toggleNodeBypass = () => {
    toggleSelectedNodesMode(LGraphEventMode.BYPASS)
    app.canvas.setDirty(true, true)
  }

  const runBranch = async () => {
    const selectedNodes = getSelectedNodes()
    const selectedOutputNodes = filterOutputNodes(selectedNodes)
    if (selectedOutputNodes.length === 0) return
    await commandStore.execute('Comfy.QueueSelectedOutputNodes')
  }

  return {
    adjustNodeSize,
    toggleNodeCollapse,
    toggleNodePin,
    toggleNodeBypass,
    runBranch
  }
}
