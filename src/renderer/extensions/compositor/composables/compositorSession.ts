import {
  applyLayerState,
  parseLayerState,
  resolveInitialLayerState
} from '@/renderer/extensions/compositor/composables/compositorLayerState'
import { imageRefViewQuery } from '@/renderer/extensions/compositor/composables/compositorPaths'
import { getCompositorWidgetValue } from '@/renderer/extensions/compositor/composables/compositorWidgets'
import {
  getCompositorBBoxes,
  getCompositorCanvas,
  getCompositorInputsFingerprint,
  getCompositorLayers
} from '@/renderer/extensions/compositor/composables/useCompositorLayers'
import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

export async function loadCompositorSession(
  session: LayerEditorSession,
  node: LGraphNode,
  fallbackLayerName: (index: number) => string
): Promise<number> {
  const refs = getCompositorLayers(node) ?? []
  const rand = app.getRandParam()
  const urls = refs.map((fileRef) =>
    api.apiURL(`/view?${imageRefViewQuery(fileRef)}${rand}`)
  )
  const names = refs.map(
    (fileRef, i) =>
      fileRef.filename.replace(/\.[^.]+$/, '') || fallbackLayerName(i)
  )
  const failed = await session.loadImages(urls, names)

  const canvas = getCompositorCanvas(node)
  const initialState = resolveInitialLayerState(
    parseLayerState(getCompositorWidgetValue(node)),
    getCompositorInputsFingerprint(node),
    getCompositorBBoxes(node),
    canvas
  )
  if (initialState) {
    applyLayerState(initialState, session.imageLayers.value, session)
    session.editor.history.clear()
    session.fitView()
  } else if (canvas) {
    session.setCanvasSize(canvas.w, canvas.h)
    session.editor.history.clear()
    session.fitView()
  }
  return failed
}
