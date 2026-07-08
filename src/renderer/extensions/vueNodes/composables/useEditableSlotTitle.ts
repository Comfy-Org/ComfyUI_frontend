import { computed, ref } from 'vue'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'

interface RenamableNode {
  renameVariableInput: (oldName: string, newName: string) => boolean
}

function isRenamable(node: unknown): node is RenamableNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as RenamableNode).renameVariableInput === 'function'
  )
}

/**
 * Inline rename for an input slot title. Editing is only offered when the owning
 * node opts in by exposing a `renameVariableInput` method, so other node types
 * keep their read-only slot labels.
 */
export function useEditableSlotTitle(
  nodeId: () => string,
  currentName: () => string
) {
  const canvasStore = useCanvasStore()
  const editing = ref(false)

  function renamableNode(): RenamableNode | undefined {
    const node = canvasStore.canvas?.graph?.getNodeById(toNodeId(nodeId()))
    return isRenamable(node) ? node : undefined
  }

  const isEditable = computed(() => !!renamableNode())

  function startEdit() {
    if (renamableNode()) editing.value = true
  }

  function commit(newName: string) {
    if (!editing.value) return
    editing.value = false
    const name = newName.trim()
    if (!name || name === currentName()) return
    const renamed = renamableNode()?.renameVariableInput(currentName(), name)
    if (renamed === false) {
      useToastStore().add({
        severity: 'warn',
        summary: t('promptNode.renameConflict', { name }),
        life: 3000
      })
    }
  }

  function cancel() {
    editing.value = false
  }

  return { editing, isEditable, startEdit, commit, cancel }
}
