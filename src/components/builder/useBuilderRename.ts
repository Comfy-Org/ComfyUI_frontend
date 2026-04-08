import { ref } from 'vue'

import type { ResolvedArrangeWidget } from '@/components/builder/useZoneWidgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { renameWidget } from '@/utils/widgetUtil'

export function useBuilderRename(
  getWidget: (key: string) => ResolvedArrangeWidget | undefined
) {
  const renamingKey = ref<string | null>(null)
  const renameValue = ref('')
  const canvasStore = useCanvasStore()

  function startRename(itemKey: string) {
    const w = getWidget(itemKey)
    if (!w) return
    renameValue.value = w.widget.label || w.widget.name
    renamingKey.value = itemKey
  }

  function confirmRename() {
    if (!renamingKey.value) return
    const w = getWidget(renamingKey.value)
    if (w) {
      const trimmed = renameValue.value.trim()
      if (trimmed) {
        renameWidget(w.widget, w.node, trimmed)
        canvasStore.canvas?.setDirty(true)
      }
    }
    renamingKey.value = null
  }

  function cancelRename() {
    renamingKey.value = null
  }

  function startRenameDeferred(itemKey: string) {
    setTimeout(() => startRename(itemKey), 50)
  }

  return {
    renamingKey,
    renameValue,
    startRename,
    confirmRename,
    cancelRename,
    startRenameDeferred
  }
}
