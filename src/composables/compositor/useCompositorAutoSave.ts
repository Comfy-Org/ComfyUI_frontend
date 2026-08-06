import { debounce } from 'es-toolkit'

import type { CompositorLayerStateSession } from '@/composables/compositor/compositorSave'
import { saveCompositorLayerState } from '@/composables/compositor/compositorSave'
import { Dirty } from '@/core/layerEditor/engine/history'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const AUTO_SAVE_DEBOUNCE_MS = 300

interface CompositorAutoSaveSession extends CompositorLayerStateSession {
  editor: {
    history: { onChange(listener: (mask: number) => void): () => void }
  }
}

export function useCompositorAutoSave(
  session: CompositorAutoSaveSession,
  node: LGraphNode
) {
  const save = debounce(() => {
    saveCompositorLayerState(session, node)
  }, AUTO_SAVE_DEBOUNCE_MS)
  const unsubscribe = session.editor.history.onChange((mask) => {
    if ((mask & ~Dirty.SELECTION) !== 0) save()
  })

  function stop(): void {
    unsubscribe()
    save.cancel()
  }

  return { stop }
}
