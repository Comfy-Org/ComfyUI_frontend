import { computed, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

interface RenamableNode {
  renameVariableInput: (oldName: string, newName: string) => void
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
  const draft = ref('')

  function renamableNode(): RenamableNode | undefined {
    const node = canvasStore.canvas?.graph?.getNodeById(nodeId())
    return isRenamable(node) ? node : undefined
  }

  const isEditable = computed(() => !!renamableNode())

  function startEdit() {
    if (!renamableNode()) return
    draft.value = currentName()
    editing.value = true
  }

  function commit() {
    if (!editing.value) return
    editing.value = false
    const name = draft.value.trim()
    if (name && name !== currentName()) {
      renamableNode()?.renameVariableInput(currentName(), name)
    }
  }

  function cancel() {
    editing.value = false
  }

  return { editing, draft, isEditable, startEdit, commit, cancel }
}
