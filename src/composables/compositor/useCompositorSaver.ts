import { useI18n } from 'vue-i18n'

import { extractLayerState } from '@/composables/compositor/compositorLayerState'
import { setCompositorWidgetValue } from '@/composables/compositor/compositorWidgets'
import {
  getCompositorInputsFingerprint,
  setCompositorPreviewOverride
} from '@/composables/compositor/useCompositorLayers'
import type { SceneNode } from 'pentrado/engine'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'

interface CompositorSaveSession {
  editor: {
    render(): void
    floating(): unknown
    anchorFloating(): void
  }
  compositor: {
    toBlob(): Promise<Blob>
  }
  canvasSize: { value: { w: number; h: number } }
  layers: { value: SceneNode[] }
  layerFlips(id: string): { h: boolean; v: boolean }
}

export function useCompositorSaver() {
  const { t } = useI18n()
  const toastStore = useToastStore()

  async function saveComposite(
    session: CompositorSaveSession,
    node: LGraphNode
  ): Promise<boolean> {
    try {
      const { editor, compositor } = session
      if (editor.floating()) editor.anchorFloating()
      editor.render()
      const blob = await compositor.toBlob()

      const layerState = extractLayerState(
        session.canvasSize.value,
        session.layers.value,
        session.layerFlips,
        getCompositorInputsFingerprint(node.id)
      )

      setCompositorWidgetValue(node, { ...layerState })
      setCompositorPreviewOverride(node.id, URL.createObjectURL(blob))
      node.graph?.setDirtyCanvas(true)
      useDialogStore().closeDialog({ key: 'global-layer-editor' })
      return true
    } catch (err) {
      console.error('[Compositor] Save failed:', err)
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('compositor.saveFailed')
      })
      return false
    }
  }

  return {
    saveComposite
  }
}
