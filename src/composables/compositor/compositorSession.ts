import {
  applyLayerState,
  parseLayerState,
  resolveInitialLayerState
} from '@/composables/compositor/compositorLayerState'
import { imageRefViewQuery } from '@/composables/compositor/compositorPaths'
import { getCompositorWidgetValue } from '@/composables/compositor/compositorWidgets'
import {
  getCompositorBBoxes,
  getCompositorInputsFingerprint,
  getCompositorLayers
} from '@/composables/compositor/useCompositorLayers'
import type { LayerEditorSession } from '@/composables/layerEditor/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

export async function loadCompositorSession(
  session: LayerEditorSession,
  node: LGraphNode,
  fallbackLayerName: (index: number) => string
): Promise<void> {
  const refs = getCompositorLayers(node.id) ?? []
  const rand = app.getRandParam()
  const urls = refs.map((fileRef) =>
    api.apiURL(`/view?${imageRefViewQuery(fileRef)}${rand}`)
  )
  const names = refs.map(
    (fileRef, i) =>
      fileRef.filename.replace(/\.[^.]+$/, '') || fallbackLayerName(i)
  )
  await session.loadImages(urls, names)

  const initialState = resolveInitialLayerState(
    parseLayerState(getCompositorWidgetValue(node)),
    getCompositorInputsFingerprint(node.id),
    getCompositorBBoxes(node.id)
  )
  if (initialState) {
    applyLayerState(initialState, session.imageLayers.value, session)
    session.editor.history.clear()
    session.fitView()
  }
}
